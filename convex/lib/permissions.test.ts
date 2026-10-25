import { describe, expect, it } from "vitest";
import { createUser, expectErrorCode, setupConvex } from "../test.helpers";
import { PERMISSIONS, requireAnyPermission, requirePermission } from "./permissions";

describe("PERMISSIONS", () => {
  it("lists every permission of the MVP", () => {
    expect([...PERMISSIONS].sort()).toEqual(
      [
        "property.create",
        "property.update.own",
        "property.update.any",
        "property.delete",
        "property.publish",
        "property.view.any",
        "user.view",
        "user.manage",
        "role.manage",
        "location.manage",
      ].sort(),
    );
  });
});

describe("requirePermission", () => {
  it("returns the user and role when the role holds the permission", async () => {
    const t = setupConvex();
    const { as, userId, roleId } = await createUser(t, { permissions: ["role.manage"] });

    const result = await as.run((ctx) => requirePermission(ctx, "role.manage"));

    expect(result.user._id).toBe(userId);
    expect(result.role._id).toBe(roleId);
  });

  it("throws FORBIDDEN when the role lacks the permission", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });

    await expectErrorCode(
      as.run((ctx) => requirePermission(ctx, "role.manage")),
      "FORBIDDEN",
    );
  });

  it("throws UNAUTHENTICATED without an identity", async () => {
    const t = setupConvex();

    await expectErrorCode(
      t.run((ctx) => requirePermission(ctx, "user.view")),
      "UNAUTHENTICATED",
    );
  });

  it("throws UNAUTHENTICATED when the identity has no user profile", async () => {
    const t = setupConvex();

    await expectErrorCode(
      t.withIdentity({ subject: "unknown" }).run((ctx) => requirePermission(ctx, "user.view")),
      "UNAUTHENTICATED",
    );
  });

  it("throws ACCOUNT_DISABLED for a disabled user, even with the permission", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"], status: "disabled" });

    await expectErrorCode(
      as.run((ctx) => requirePermission(ctx, "user.view")),
      "ACCOUNT_DISABLED",
    );
  });

  it("throws PASSWORD_CHANGE_REQUIRED while the user must change their password", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"], mustChangePassword: true });

    await expectErrorCode(
      as.run((ctx) => requirePermission(ctx, "user.view")),
      "PASSWORD_CHANGE_REQUIRED",
    );
  });

  it("throws FORBIDDEN when the user's role no longer exists", async () => {
    const t = setupConvex();
    const { as, roleId } = await createUser(t, { permissions: ["user.view"] });
    await t.run((ctx) => ctx.db.delete(roleId));

    await expectErrorCode(
      as.run((ctx) => requirePermission(ctx, "user.view")),
      "FORBIDDEN",
    );
  });

  it("lets the system role through for every permission", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: [], isSystem: true });

    for (const permission of PERMISSIONS) {
      await expect(as.run((ctx) => requirePermission(ctx, permission))).resolves.toBeDefined();
    }
  });
});

describe("requireAnyPermission", () => {
  it("passes when the role holds one of the permissions", async () => {
    const t = setupConvex();
    const { as, userId } = await createUser(t, { permissions: ["user.view"] });

    const result = await as.run((ctx) =>
      requireAnyPermission(ctx, ["role.manage", "user.view"]),
    );

    expect(result.user._id).toBe(userId);
  });

  it("throws FORBIDDEN when the role holds none of them", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["property.create"] });

    await expectErrorCode(
      as.run((ctx) => requireAnyPermission(ctx, ["role.manage", "user.view"])),
      "FORBIDDEN",
    );
  });
});
