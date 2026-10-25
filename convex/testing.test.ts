import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { createAccount, setupConvex, signIn } from "./test.helpers";

describe("testing.reset", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses to run unless IS_TEST is set", async () => {
    const t = setupConvex();
    await createAccount(t);

    await expect(t.mutation(internal.testing.reset, {})).rejects.toThrow(/IS_TEST/);
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  it("wipes app and auth data so setup can run again", async () => {
    vi.stubEnv("IS_TEST", "true");
    const t = setupConvex();
    const { email, password } = await createAccount(t);

    await t.mutation(internal.testing.reset, {});

    await expect(t.query(api.setup.status, {})).resolves.toEqual({ needed: true });
    const roles = await t.run((ctx) => ctx.db.query("roles").collect());
    expect(roles).toHaveLength(0);
    expect((await signIn(t, email, password)).status).toBe(401);
  });
});

