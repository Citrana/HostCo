import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { PIN_TTL_MS } from "./lib/pin";
import { rateLimiter } from "./rateLimits";
import {
  createAccount,
  createUser,
  expectErrorCode,
  listSessions,
  profileOf,
  setupConvex,
  signIn,
  signedIn,
  storedDocuments,
} from "./test.helpers";

type TestConvex = ReturnType<typeof setupConvex>;

async function insertRole(
  t: TestConvex,
  permissions: ("property.create" | "user.view" | "user.manage" | "role.manage")[] = [
    "property.create",
  ],
  isSystem = false,
) {
  return await t.run((ctx) =>
    ctx.db.insert("roles", {
      key: null,
      name: { fr: "Rédacteur", en: "Writer" },
      permissions,
      isSystem,
    }),
  );
}

/** A Super Admin acting through the shared system role. */
async function superAdmin(t: TestConvex, systemRoleId?: Id<"roles">) {
  const roleId = systemRoleId ?? (await insertRole(t, [], true));
  return { ...(await createUser(t, { roleId })), systemRoleId: roleId };
}

const newUser = { name: "Grace Mbuyi", email: "Grace@Example.com " };

describe("users.list", () => {
  it("returns every user with their role name to a user with user.view", async () => {
    const t = setupConvex();
    const { as, userId } = await createUser(t, { permissions: ["user.view"] });

    const users = await as.query(api.users.list, {});

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      _id: userId,
      status: "active",
      roleName: { en: expect.stringMatching(/^Role /) },
    });
  });

  it("never exposes the auth user id", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });

    const [user] = await as.query(api.users.list, {});

    expect(user).not.toHaveProperty("authUserId");
  });

  it("is forbidden without user.view", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.manage"] });

    await expectErrorCode(as.query(api.users.list, {}), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();

    await expectErrorCode(t.query(api.users.list, {}), "UNAUTHENTICATED");
  });
});

describe("users.get", () => {
  it("returns one user to a user with user.view", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const other = await createUser(t);

    const user = await as.query(api.users.get, { id: other.userId });

    expect(user).toMatchObject({ _id: other.userId, roleId: other.roleId });
    expect(user).not.toHaveProperty("authUserId");
  });

  // The id comes from the URL, so a typo must not crash the page.
  it("returns null for a malformed or deleted id", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const other = await createUser(t);
    await t.run((ctx) => ctx.db.delete("users", other.userId));

    await expect(as.query(api.users.get, { id: "not-an-id" })).resolves.toBeNull();
    await expect(as.query(api.users.get, { id: other.userId })).resolves.toBeNull();
  });

  it("is forbidden without user.view", async () => {
    const t = setupConvex();
    const { as, userId } = await createUser(t, { permissions: ["user.manage"] });

    await expectErrorCode(as.query(api.users.get, { id: userId }), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const { userId } = await createUser(t);

    await expectErrorCode(t.query(api.users.get, { id: userId }), "UNAUTHENTICATED");
  });
});

describe("users.create", () => {
  it("creates a user who must replace a one-time PIN, and returns the PIN once", async () => {
    const t = setupConvex();
    const { as, userId: adminId, systemRoleId } = await superAdmin(t);
    const roleId = await insertRole(t);
    const before = Date.now();

    const { id, pin } = await as.mutation(api.users.create, { ...newUser, roleId });

    expect(pin).toMatch(/^\d{8}$/);
    const profile = await profileOf(t, id);
    expect(profile).toMatchObject({
      name: "Grace Mbuyi",
      email: "grace@example.com",
      roleId,
      status: "active",
      mustChangePassword: true,
      createdBy: adminId,
    });
    expect(profile?.pinExpiresAt).toBeGreaterThanOrEqual(before + PIN_TTL_MS);
    expect(systemRoleId).not.toBe(roleId);
    expect((await signIn(t, "grace@example.com", pin)).status).toBe(200);
  });

  it("never stores the PIN in plain text", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const roleId = await insertRole(t);

    const { pin } = await as.mutation(api.users.create, { ...newUser, roleId });

    const stored = await storedDocuments(t);
    expect(stored).toContain("grace@example.com");
    expect(stored).not.toContain(pin);
  });

  it("refuses an email that is already used", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const roleId = await insertRole(t);
    await createAccount(t, { email: "grace@example.com" });

    await expectErrorCode(as.mutation(api.users.create, { ...newUser, roleId }), "EMAIL_TAKEN");
  });

  it("refuses an invalid email or an empty name", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const roleId = await insertRole(t);

    await expectErrorCode(
      as.mutation(api.users.create, { name: "Grace", email: "not-an-email", roleId }),
      "EMAIL_INVALID",
    );
    await expectErrorCode(
      as.mutation(api.users.create, { name: "  ", email: "grace@example.com", roleId }),
      "NAME_INVALID",
    );
  });

  it("refuses a role that doesn't exist", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const roleId = await insertRole(t);
    await t.run((ctx) => ctx.db.delete("roles", roleId));

    await expectErrorCode(as.mutation(api.users.create, { ...newUser, roleId }), "ROLE_NOT_FOUND");
  });

  it("lets a non-system manager assign only roles within their own permissions", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.manage", "property.create"] });
    const narrower = await insertRole(t, ["property.create"]);
    const wider = await insertRole(t, ["role.manage"]);

    await expect(
      as.mutation(api.users.create, { ...newUser, roleId: narrower }),
    ).resolves.toMatchObject({ pin: expect.any(String) });
    await expectErrorCode(
      as.mutation(api.users.create, { name: "Eve", email: "eve@example.com", roleId: wider }),
      "FORBIDDEN",
    );
  });

  it("lets only a Super Admin grant the Super Admin role", async () => {
    const t = setupConvex();
    const systemRoleId = await insertRole(t, [], true);
    const { as } = await createUser(t, {
      permissions: ["user.manage", "user.view", "role.manage", "property.create"],
    });

    await expectErrorCode(
      as.mutation(api.users.create, { ...newUser, roleId: systemRoleId }),
      "FORBIDDEN",
    );
  });

  it("is forbidden without user.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const roleId = await insertRole(t);

    await expectErrorCode(as.mutation(api.users.create, { ...newUser, roleId }), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const roleId = await insertRole(t);

    await expectErrorCode(t.mutation(api.users.create, { ...newUser, roleId }), "UNAUTHENTICATED");
  });
});

describe("users.update", () => {
  it("changes a user's name and role", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createUser(t);
    const roleId = await insertRole(t);

    await as.mutation(api.users.update, { id: target.userId, name: " Grace M. ", roleId });

    expect(await profileOf(t, target.userId)).toMatchObject({ name: "Grace M.", roleId });
  });

  it("refuses an empty name", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createUser(t);

    await expectErrorCode(
      as.mutation(api.users.update, { id: target.userId, name: "", roleId: target.roleId }),
      "NAME_INVALID",
    );
  });

  it("refuses a user that doesn't exist", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createUser(t);
    await t.run((ctx) => ctx.db.delete("users", target.userId));

    await expectErrorCode(
      as.mutation(api.users.update, { id: target.userId, name: "Grace", roleId: target.roleId }),
      "USER_NOT_FOUND",
    );
  });

  it("doesn't let a non-system manager edit a user whose role exceeds theirs", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.manage"] });
    const target = await createUser(t, { permissions: ["role.manage"] });

    await expectErrorCode(
      as.mutation(api.users.update, { id: target.userId, name: "Grace", roleId: target.roleId }),
      "FORBIDDEN",
    );
  });

  it("doesn't let a non-system manager promote a user beyond their own permissions", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.manage", "property.create"] });
    const target = await createUser(t, { permissions: ["property.create"] });
    const wider = await insertRole(t, ["role.manage"]);

    await expectErrorCode(
      as.mutation(api.users.update, { id: target.userId, name: "Grace", roleId: wider }),
      "FORBIDDEN",
    );
  });

  it("refuses to demote the last active Super Admin", async () => {
    const t = setupConvex();
    const { as, userId } = await superAdmin(t);
    const roleId = await insertRole(t);

    await expectErrorCode(
      as.mutation(api.users.update, { id: userId, name: "Admin", roleId }),
      "LAST_SUPER_ADMIN",
    );
  });

  it("doesn't count a disabled Super Admin as another one", async () => {
    const t = setupConvex();
    const { as, userId, systemRoleId } = await superAdmin(t);
    await createUser(t, { roleId: systemRoleId, status: "disabled" });
    const roleId = await insertRole(t);

    await expectErrorCode(
      as.mutation(api.users.update, { id: userId, name: "Admin", roleId }),
      "LAST_SUPER_ADMIN",
    );
  });

  it("demotes a Super Admin while another active one remains", async () => {
    const t = setupConvex();
    const { as, systemRoleId } = await superAdmin(t);
    const other = await superAdmin(t, systemRoleId);
    const roleId = await insertRole(t);

    await as.mutation(api.users.update, { id: other.userId, name: "Other", roleId });

    expect(await profileOf(t, other.userId)).toMatchObject({ roleId });
  });

  it("is forbidden without user.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const target = await createUser(t);

    await expectErrorCode(
      as.mutation(api.users.update, { id: target.userId, name: "Grace", roleId: target.roleId }),
      "FORBIDDEN",
    );
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const target = await createUser(t);

    await expectErrorCode(
      t.mutation(api.users.update, { id: target.userId, name: "Grace", roleId: target.roleId }),
      "UNAUTHENTICATED",
    );
  });
});

describe("users.setStatus", () => {
  it("disables a user and signs out all their sessions", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createAccount(t);
    await signedIn(t, target.email, target.password);

    await as.mutation(api.users.setStatus, { id: target.userId, status: "disabled" });

    expect(await profileOf(t, target.userId)).toMatchObject({ status: "disabled" });
    expect(await listSessions(t, target.authUserId)).toEqual([]);
    expect((await signIn(t, target.email, target.password)).status).toBe(403);
  });

  it("enables a disabled user again", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createAccount(t, { status: "disabled" });

    await as.mutation(api.users.setStatus, { id: target.userId, status: "active" });

    expect((await signIn(t, target.email, target.password)).status).toBe(200);
  });

  it("refuses to disable the last active Super Admin", async () => {
    const t = setupConvex();
    const { as, userId } = await superAdmin(t);

    await expectErrorCode(
      as.mutation(api.users.setStatus, { id: userId, status: "disabled" }),
      "LAST_SUPER_ADMIN",
    );
  });

  it("disables a Super Admin while another active one remains", async () => {
    const t = setupConvex();
    const { as, systemRoleId } = await superAdmin(t);
    const other = await superAdmin(t, systemRoleId);

    await as.mutation(api.users.setStatus, { id: other.userId, status: "disabled" });

    expect(await profileOf(t, other.userId)).toMatchObject({ status: "disabled" });
  });

  it("doesn't let a non-system manager disable a Super Admin", async () => {
    const t = setupConvex();
    const { systemRoleId } = await superAdmin(t);
    const target = await superAdmin(t, systemRoleId);
    const { as } = await createUser(t, {
      permissions: ["user.manage", "user.view", "role.manage", "property.create"],
    });

    await expectErrorCode(
      as.mutation(api.users.setStatus, { id: target.userId, status: "disabled" }),
      "FORBIDDEN",
    );
  });

  it("refuses a user that doesn't exist", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createUser(t);
    await t.run((ctx) => ctx.db.delete("users", target.userId));

    await expectErrorCode(
      as.mutation(api.users.setStatus, { id: target.userId, status: "disabled" }),
      "USER_NOT_FOUND",
    );
  });

  it("is forbidden without user.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const target = await createUser(t);

    await expectErrorCode(
      as.mutation(api.users.setStatus, { id: target.userId, status: "disabled" }),
      "FORBIDDEN",
    );
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const target = await createUser(t);

    await expectErrorCode(
      t.mutation(api.users.setStatus, { id: target.userId, status: "disabled" }),
      "UNAUTHENTICATED",
    );
  });
});

describe("users.resetPin", () => {
  it("replaces the password with a new PIN that must be changed", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createAccount(t);
    const before = Date.now();

    const { pin } = await as.mutation(api.users.resetPin, { id: target.userId });

    expect(pin).toMatch(/^\d{8}$/);
    const profile = await profileOf(t, target.userId);
    expect(profile).toMatchObject({ mustChangePassword: true });
    expect(profile?.pinExpiresAt).toBeGreaterThanOrEqual(before + PIN_TTL_MS);
    expect((await signIn(t, target.email, target.password)).status).toBe(401);
    expect((await signIn(t, target.email, pin)).status).toBe(200);
  });

  it("signs out all the user's sessions", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createAccount(t);
    await signedIn(t, target.email, target.password);
    await signedIn(t, target.email, target.password);

    await as.mutation(api.users.resetPin, { id: target.userId });

    expect(await listSessions(t, target.authUserId)).toEqual([]);
  });

  // PR 3 made the reset the way out of a per-email sign-in lockout.
  it("lifts the sign-in lockout so the user can use the new PIN", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createAccount(t);
    for (let i = 0; i < 5; i += 1) await signIn(t, target.email, `wrong-${i}`);
    expect((await signIn(t, target.email, target.password)).status).toBe(429);

    const { pin } = await as.mutation(api.users.resetPin, { id: target.userId });

    expect((await signIn(t, target.email, pin)).status).toBe(200);
    const { ok } = await t.run((ctx) =>
      rateLimiter.check(ctx, "failedPasswordChange", { key: target.userId }),
    );
    expect(ok).toBe(true);
  });

  it("never stores the new PIN in plain text", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createAccount(t);

    const { pin } = await as.mutation(api.users.resetPin, { id: target.userId });

    expect(await storedDocuments(t)).not.toContain(pin);
  });

  // A stolen session could otherwise swap the password without knowing it.
  it("refuses to reset the caller's own PIN", async () => {
    const t = setupConvex();
    const { as, userId } = await superAdmin(t);

    await expectErrorCode(as.mutation(api.users.resetPin, { id: userId }), "FORBIDDEN");
  });

  it("doesn't let a non-system manager reset a Super Admin's PIN", async () => {
    const t = setupConvex();
    const { systemRoleId } = await superAdmin(t);
    const target = await superAdmin(t, systemRoleId);
    const { as } = await createUser(t, {
      permissions: ["user.manage", "user.view", "role.manage", "property.create"],
    });

    await expectErrorCode(as.mutation(api.users.resetPin, { id: target.userId }), "FORBIDDEN");
  });

  it("refuses a user that doesn't exist", async () => {
    const t = setupConvex();
    const { as } = await superAdmin(t);
    const target = await createUser(t);
    await t.run((ctx) => ctx.db.delete("users", target.userId));

    await expectErrorCode(as.mutation(api.users.resetPin, { id: target.userId }), "USER_NOT_FOUND");
  });

  it("is forbidden without user.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const target = await createUser(t);

    await expectErrorCode(as.mutation(api.users.resetPin, { id: target.userId }), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const target = await createUser(t);

    await expectErrorCode(t.mutation(api.users.resetPin, { id: target.userId }), "UNAUTHENTICATED");
  });
});
