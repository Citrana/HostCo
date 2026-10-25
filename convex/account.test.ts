import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { PERMISSIONS } from "./lib/permissions";
import {
  createAccount,
  createUser,
  expectErrorCode,
  listSessions,
  profileOf,
  setupConvex,
  signIn,
  signedIn,
} from "./test.helpers";

const NEW_PASSWORD = "a-brand-new-secret";

describe("account.me", () => {
  it("returns the signed-in user's profile and role name", async () => {
    const t = setupConvex();
    const { as, roleId } = await createUser(t, { permissions: ["user.view"] });

    const me = await as.query(api.account.me, {});

    const role = await t.run((ctx) => ctx.db.get("roles", roleId));
    expect(me).toMatchObject({ mustChangePassword: false, roleName: role?.name });
    expect(me?.email).toMatch(/@example\.com$/);
  });

  it("returns the user's id and the permissions their role grants", async () => {
    const t = setupConvex();
    const { as, userId, roleId } = await createUser(t, {
      permissions: ["user.view", "role.manage"],
    });

    const me = await as.query(api.account.me, {});

    expect(me).toMatchObject({ id: userId, roleId, permissions: ["user.view", "role.manage"] });
  });

  it("gives a Super Admin every permission", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { isSystem: true });

    const me = await as.query(api.account.me, {});

    expect(me?.permissions).toEqual([...PERMISSIONS]);
  });

  it("still answers while the user must change their password", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { mustChangePassword: true });

    await expect(as.query(api.account.me, {})).resolves.toMatchObject({ mustChangePassword: true });
  });

  // null instead of an error: useQuery would throw it during render.
  it("returns null for a disabled user", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { status: "disabled" });

    await expect(as.query(api.account.me, {})).resolves.toBeNull();
  });

  it("returns null for an identity without a profile", async () => {
    const t = setupConvex();

    await expect(t.withIdentity({ subject: "gone" }).query(api.account.me, {})).resolves.toBeNull();
  });

  it("returns null for an unauthenticated caller", async () => {
    const t = setupConvex();

    await expect(t.query(api.account.me, {})).resolves.toBeNull();
  });
});

describe("account.changePassword", () => {
  async function pinUser(t: ReturnType<typeof setupConvex>) {
    return await createAccount(t, {
      password: "12345678",
      mustChangePassword: true,
      pinExpiresAt: Date.now() + 60_000,
    });
  }

  it("replaces the PIN, clears the flag and keeps the user signed in", async () => {
    const t = setupConvex();
    const { email, password, userId } = await pinUser(t);
    const { as } = await signedIn(t, email, password);

    const result = await as.mutation(api.account.changePassword, {
      currentPassword: password,
      newPassword: NEW_PASSWORD,
    });

    expect(result).toEqual({ ok: true });
    expect(await profileOf(t, userId)).toMatchObject({
      mustChangePassword: false,
      pinExpiresAt: null,
    });
    await expect(as.query(api.account.me, {})).resolves.toBeDefined();
    expect((await signIn(t, email, password)).status).toBe(401);
    expect((await signIn(t, email, NEW_PASSWORD)).status).toBe(200);
  });

  it("revokes the user's other sessions but not the current one", async () => {
    const t = setupConvex();
    const { email, password, authUserId } = await pinUser(t);
    await signedIn(t, email, password);
    const current = await signedIn(t, email, password);

    await current.as.mutation(api.account.changePassword, {
      currentPassword: password,
      newPassword: NEW_PASSWORD,
    });

    expect(await listSessions(t, authUserId)).toEqual([current.sessionId]);
  });

  it("rejects a wrong current password and keeps the flag", async () => {
    const t = setupConvex();
    const { email, password, userId } = await pinUser(t);
    const { as } = await signedIn(t, email, password);

    const result = await as.mutation(api.account.changePassword, {
      currentPassword: "87654321",
      newPassword: NEW_PASSWORD,
    });

    expect(result).toEqual({ ok: false, code: "INVALID_CREDENTIALS" });
    expect(await profileOf(t, userId)).toMatchObject({ mustChangePassword: true });
  });

  it("stops guessing the current password after 5 wrong attempts", async () => {
    const t = setupConvex();
    const { email, password, userId } = await pinUser(t);
    const { as } = await signedIn(t, email, password);
    const attempt = (currentPassword: string) =>
      as.mutation(api.account.changePassword, { currentPassword, newPassword: NEW_PASSWORD });

    for (let i = 0; i < 5; i += 1) {
      await expect(attempt(`0000000${i}`)).resolves.toMatchObject({ ok: false });
    }

    await expect(attempt(password)).resolves.toEqual({ ok: false, code: "TOO_MANY_ATTEMPTS" });
    expect(await profileOf(t, userId)).toMatchObject({ mustChangePassword: true });
  });

  it("refuses to reuse the current password", async () => {
    const t = setupConvex();
    const { email, password } = await createAccount(t, { password: NEW_PASSWORD });
    const { as } = await signedIn(t, email, password);

    await expectErrorCode(
      as.mutation(api.account.changePassword, {
        currentPassword: password,
        newPassword: password,
      }),
      "PASSWORD_REUSED",
    );
  });

  it("refuses a new password shorter than 10 characters", async () => {
    const t = setupConvex();
    const { email, password } = await pinUser(t);
    const { as } = await signedIn(t, email, password);

    await expectErrorCode(
      as.mutation(api.account.changePassword, {
        currentPassword: password,
        newPassword: "too-short",
      }),
      "PASSWORD_TOO_SHORT",
    );
  });

  it("rejects a disabled user", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { status: "disabled" });

    await expectErrorCode(
      as.mutation(api.account.changePassword, {
        currentPassword: "12345678",
        newPassword: NEW_PASSWORD,
      }),
      "ACCOUNT_DISABLED",
    );
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();

    await expectErrorCode(
      t.mutation(api.account.changePassword, {
        currentPassword: "12345678",
        newPassword: NEW_PASSWORD,
      }),
      "UNAUTHENTICATED",
    );
  });
});
