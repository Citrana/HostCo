import { describe, expect, it } from "vitest";
import { api, components } from "./_generated/api";
import { expectErrorCode, setupConvex, signIn } from "./test.helpers";

const admin = { name: " Amani Kabila ", email: " Amani@Example.com ", password: "a-long-secret-1" };

describe("setup.status", () => {
  it("says setup is needed while there are no users", async () => {
    const t = setupConvex();

    await expect(t.query(api.setup.status, {})).resolves.toEqual({ needed: true });
  });

  it("says setup is done once the first admin exists", async () => {
    const t = setupConvex();
    await t.mutation(api.setup.bootstrapSuperAdmin, admin);

    await expect(t.query(api.setup.status, {})).resolves.toEqual({ needed: false });
  });
});

describe("setup.bootstrapSuperAdmin", () => {
  it("creates a Super Admin who can sign in right away", async () => {
    const t = setupConvex();

    await t.mutation(api.setup.bootstrapSuperAdmin, admin);

    const [user] = await t.run((ctx) => ctx.db.query("users").collect());
    const role = await t.run((ctx) => ctx.db.get("roles", user.roleId));
    expect(user).toMatchObject({
      name: "Amani Kabila",
      email: "amani@example.com",
      status: "active",
      mustChangePassword: false,
      pinExpiresAt: null,
      createdBy: null,
    });
    expect(role).toMatchObject({ key: "superAdmin", isSystem: true });
    const response = await signIn(t, "amani@example.com", admin.password);
    expect(response.status).toBe(200);
  });

  it("seeds the seven default roles", async () => {
    const t = setupConvex();

    await t.mutation(api.setup.bootstrapSuperAdmin, admin);

    const roles = await t.run((ctx) => ctx.db.query("roles").collect());
    expect(roles).toHaveLength(7);
  });

  it("works only once", async () => {
    const t = setupConvex();
    await t.mutation(api.setup.bootstrapSuperAdmin, admin);

    await expectErrorCode(
      t.mutation(api.setup.bootstrapSuperAdmin, { ...admin, email: "other@example.com" }),
      "SETUP_ALREADY_DONE",
    );
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  it("lets only one of two racing attempts through", async () => {
    const t = setupConvex();

    const results = await Promise.allSettled([
      t.mutation(api.setup.bootstrapSuperAdmin, admin),
      t.mutation(api.setup.bootstrapSuperAdmin, { ...admin, email: "other@example.com" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { data: { code: "SETUP_ALREADY_DONE" } } });
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  it("refuses an email that already has an auth account", async () => {
    const t = setupConvex();
    await t.mutation(api.setup.bootstrapSuperAdmin, admin);
    // An auth account left behind without a profile, e.g. after a data reset.
    await t.run(async (ctx) => {
      for (const user of await ctx.db.query("users").collect()) await ctx.db.delete("users", user._id);
    });

    await expectErrorCode(t.mutation(api.setup.bootstrapSuperAdmin, admin), "EMAIL_TAKEN");
  });

  it.each([
    [{ ...admin, name: "  " }, "NAME_INVALID"],
    [{ ...admin, name: "N".repeat(101) }, "NAME_INVALID"],
    [{ ...admin, email: "not-an-email" }, "EMAIL_INVALID"],
    [{ ...admin, password: "short" }, "PASSWORD_TOO_SHORT"],
    [{ ...admin, password: "p".repeat(129) }, "PASSWORD_TOO_LONG"],
  ] as const)("rejects invalid input (%#)", async (args, code) => {
    const t = setupConvex();

    await expectErrorCode(t.mutation(api.setup.bootstrapSuperAdmin, args), code);
    await expect(t.query(api.setup.status, {})).resolves.toEqual({ needed: true });
  });

  it("never stores the password in plain text", async () => {
    const t = setupConvex();

    await t.mutation(api.setup.bootstrapSuperAdmin, admin);

    const stored = await t.run(async (ctx) => {
      const appDocs = [
        ...(await ctx.db.query("users").collect()),
        ...(await ctx.db.query("roles").collect()),
      ];
      const authDocs = [];
      for (const model of ["user", "account", "session"] as const) {
        const result: { page: unknown[] } = await ctx.runQuery(
          components.betterAuth.adapter.findMany,
          { model, paginationOpts: { numItems: 100, cursor: null } },
        );
        authDocs.push(...result.page);
      }
      return JSON.stringify([appDocs, authDocs]);
    });
    expect(stored).toContain("amani@example.com");
    expect(stored).not.toContain(admin.password);
  });
});
