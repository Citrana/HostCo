import { describe, expect, it } from "vitest";
import { components } from "./_generated/api";
import { createAccount, setupConvex, SITE_URL, signIn } from "./test.helpers";

async function errorCode(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

async function sessionCount(t: ReturnType<typeof setupConvex>, authUserId: string) {
  const result = await t.run(
    async (ctx): Promise<{ page: unknown[] }> =>
      await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "session",
        where: [{ field: "userId", value: authUserId }],
        paginationOpts: { numItems: 100, cursor: null },
      }),
  );
  return result.page.length;
}

describe("sign-in", () => {
  it("accepts a PIN that hasn't expired", async () => {
    const t = setupConvex();
    const { email, password } = await createAccount(t, {
      mustChangePassword: true,
      pinExpiresAt: Date.now() + 60_000,
    });

    expect((await signIn(t, email, password)).status).toBe(200);
  });

  it("rejects an expired PIN without creating a session", async () => {
    const t = setupConvex();
    const { email, password, authUserId } = await createAccount(t, {
      mustChangePassword: true,
      pinExpiresAt: Date.now() - 1,
    });

    const response = await signIn(t, email, password);

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("PIN_EXPIRED");
    expect(await sessionCount(t, authUserId)).toBe(0);
  });

  it("rejects a disabled account", async () => {
    const t = setupConvex();
    const { email, password } = await createAccount(t, { status: "disabled" });

    const response = await signIn(t, email, password);

    expect(response.status).toBe(403);
    expect(await errorCode(response)).toBe("ACCOUNT_DISABLED");
  });

  it("blocks an email after 5 attempts in 15 minutes, even with the right password", async () => {
    const t = setupConvex();
    const { email, password } = await createAccount(t);
    const other = await createAccount(t);

    // A different IP for every attempt, so only the per-email limit applies.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await signIn(t, email, "wrong-password-1", { ip: `203.0.113.${attempt}` });
      expect(response.status).toBe(401);
    }
    const blocked = await signIn(t, email.toUpperCase(), password, { ip: "203.0.113.99" });

    expect(blocked.status).toBe(429);
    expect(await errorCode(blocked)).toBe("TOO_MANY_ATTEMPTS");
    expect((await signIn(t, other.email, other.password)).status).toBe(200);
  });

  it("also limits attempts per IP", async () => {
    const t = setupConvex();
    const accounts = [];
    for (let i = 0; i < 6; i += 1) accounts.push(await createAccount(t));

    for (const account of accounts.slice(0, 5)) {
      await signIn(t, account.email, "wrong-password-1", { ip: "198.51.100.7" });
    }
    const blocked = await signIn(t, accounts[5].email, accounts[5].password, { ip: "198.51.100.7" });

    expect(blocked.status).toBe(429);
  });

  it("doesn't put clients without a known IP in one shared bucket", async () => {
    const t = setupConvex();
    const accounts = [];
    for (let i = 0; i < 6; i += 1) accounts.push(await createAccount(t));

    // No x-forwarded-for: Better Auth would otherwise key all of these alike,
    // and one person's failures would lock everyone out.
    for (const account of accounts.slice(0, 5)) {
      await signIn(t, account.email, "wrong-password-1");
    }
    const other = await signIn(t, accounts[5].email, accounts[5].password);

    expect(other.status).toBe(200);
  });

  it("doesn't rate-limit nested paths like the JWKS into one shared bucket", async () => {
    const t = setupConvex();

    // Better Auth's default rule allows 100 requests per window per key.
    const statuses = [];
    for (let i = 0; i < 101; i += 1) {
      statuses.push((await t.fetch("/api/auth/convex/jwks")).status);
    }

    expect(statuses.filter((status) => status === 429)).toEqual([]);
  });

  // Checking the limit and recording a failure must be one step; otherwise
  // parallel guesses all pass the check before any failure is recorded.
  it("enforces the email limit on parallel attempts", async () => {
    const t = setupConvex();
    const { email } = await createAccount(t);

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, attempt) =>
        signIn(t, email, `wrong-password-${attempt}`, { ip: `203.0.113.${attempt}` }),
      ),
    );

    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 401)).toHaveLength(5);
    expect(statuses.filter((status) => status === 429)).toHaveLength(5);
  });

  it("doesn't count successful sign-ins against the email limit", async () => {
    const t = setupConvex();
    const { email, password } = await createAccount(t);

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = await signIn(t, email, password, { ip: `203.0.113.${attempt}` });
      expect(response.status).toBe(200);
    }
  });

  it.each([
    ["POST", "/api/auth/change-password"],
    ["POST", "/api/auth/update-user"],
    ["POST", "/api/auth/delete-user"],
    ["POST", "/api/auth/request-password-reset"],
    ["GET", "/api/auth/list-sessions"],
  ])("refuses %s %s, which the app doesn't use", async (method, path) => {
    const t = setupConvex();

    const response = await t.fetch(path, {
      method,
      headers: { "content-type": "application/json", origin: SITE_URL },
      ...(method === "POST" ? { body: "{}" } : {}),
    });

    expect(response.status).toBe(404);
  });

  it.each(["/api/auth/get-session", "/api/auth/convex/jwks"])(
    "still serves %s, which the client needs",
    async (path) => {
      const t = setupConvex();

      const response = await t.fetch(path, { headers: { origin: SITE_URL } });

      expect(response.status).toBe(200);
    },
  );

  it("keeps public sign-up closed", async () => {
    const t = setupConvex();

    const response = await t.fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: SITE_URL },
      body: JSON.stringify({ name: "Eve", email: "eve@example.com", password: "a-long-secret-1" }),
    });

    expect(response.status).toBe(404);
    const users = await t.run(
      async (ctx): Promise<{ page: unknown[] }> =>
        await ctx.runQuery(components.betterAuth.adapter.findMany, {
          model: "user",
          paginationOpts: { numItems: 10, cursor: null },
        }),
    );
    expect(users.page).toHaveLength(0);
  });
});
