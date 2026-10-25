import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createUser, expectErrorCode, setupConvex } from "./test.helpers";

const name = { fr: "Rédacteur", en: "Writer" };

async function insertRole(
  t: ReturnType<typeof setupConvex>,
  overrides: { isSystem?: boolean; key?: string | null } = {},
) {
  return (await t.run((ctx) =>
    ctx.db.insert("roles", {
      key: overrides.key ?? null,
      name,
      permissions: ["property.create"],
      isSystem: overrides.isSystem ?? false,
    }),
  )) as Id<"roles">;
}

describe("roles.list", () => {
  it("returns the roles to a user with user.view", async () => {
    const t = setupConvex();
    const { as, roleId } = await createUser(t, { permissions: ["user.view"] });

    const roles = await as.query(api.roles.list, {});

    expect(roles.map((role) => role._id)).toContain(roleId);
  });

  it("returns the roles to a user with role.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });

    await expect(as.query(api.roles.list, {})).resolves.toHaveLength(1);
  });

  it("is forbidden without user.view or role.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["property.create"] });

    await expectErrorCode(as.query(api.roles.list, {}), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();

    await expectErrorCode(t.query(api.roles.list, {}), "UNAUTHENTICATED");
  });
});

describe("roles.get", () => {
  it("returns the role to a user with user.view", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const id = await insertRole(t);

    const role = await as.query(api.roles.get, { id });

    expect(role).toMatchObject({ _id: id, name });
  });

  it("returns null for a role that doesn't exist", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t);
    await t.run((ctx) => ctx.db.delete(id));

    await expect(as.query(api.roles.get, { id })).resolves.toBeNull();
  });

  it("is forbidden without user.view or role.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["property.create"] });
    const id = await insertRole(t);

    await expectErrorCode(as.query(api.roles.get, { id }), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const id = await insertRole(t);

    await expectErrorCode(t.query(api.roles.get, { id }), "UNAUTHENTICATED");
  });
});

describe("roles.create", () => {
  it("creates a custom role with trimmed names and unique permissions", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });

    const id = await as.mutation(api.roles.create, {
      name: { fr: "  Rédacteur ", en: " Writer  " },
      permissions: ["property.create", "property.update.own", "property.create"],
    });

    const role = await t.run((ctx) => ctx.db.get(id));
    expect(role).toMatchObject({
      key: null,
      name,
      permissions: ["property.create", "property.update.own"],
      isSystem: false,
    });
  });

  it("rejects a name that is blank in either language", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });

    await expectErrorCode(
      as.mutation(api.roles.create, { name: { fr: "Rédacteur", en: "  " }, permissions: [] }),
      "ROLE_INVALID",
    );
    await expectErrorCode(
      as.mutation(api.roles.create, { name: { fr: "", en: "Writer" }, permissions: [] }),
      "ROLE_INVALID",
    );
  });

  it("rejects a name longer than 60 characters", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });

    await expectErrorCode(
      as.mutation(api.roles.create, {
        name: { fr: "R".repeat(61), en: "Writer" },
        permissions: [],
      }),
      "ROLE_INVALID",
    );
  });

  it("rejects an unknown permission through the validator", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });

    await expect(
      as.mutation(api.roles.create, {
        name,
        // @ts-expect-error: the validator must reject permissions that don't exist
        permissions: ["property.burn"],
      }),
    ).rejects.toThrow(/Validator error/);
  });

  it("is forbidden without role.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view", "user.manage"] });

    await expectErrorCode(
      as.mutation(api.roles.create, { name, permissions: [] }),
      "FORBIDDEN",
    );
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();

    await expectErrorCode(t.mutation(api.roles.create, { name, permissions: [] }), "UNAUTHENTICATED");
  });
});

describe("roles.update", () => {
  const changes = { name: { fr: " Relecteur", en: "Reviewer " }, permissions: ["property.publish" as const] };

  it("updates the name and permissions of a custom role", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t, { key: "contentManager" });

    await as.mutation(api.roles.update, { id, ...changes });

    const role = await t.run((ctx) => ctx.db.get(id));
    expect(role).toMatchObject({
      key: "contentManager",
      name: { fr: "Relecteur", en: "Reviewer" },
      permissions: ["property.publish"],
      isSystem: false,
    });
  });

  it("refuses to edit the system role", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t, { isSystem: true, key: "superAdmin" });

    await expectErrorCode(as.mutation(api.roles.update, { id, ...changes }), "SYSTEM_ROLE_LOCKED");
  });

  it("throws ROLE_NOT_FOUND for a deleted role", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t);
    await t.run((ctx) => ctx.db.delete(id));

    await expectErrorCode(as.mutation(api.roles.update, { id, ...changes }), "ROLE_NOT_FOUND");
  });

  it("rejects a blank name", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t);

    await expectErrorCode(
      as.mutation(api.roles.update, { id, name: { fr: " ", en: "Reviewer" }, permissions: [] }),
      "ROLE_INVALID",
    );
  });

  it("is forbidden without role.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.view"] });
    const id = await insertRole(t);

    await expectErrorCode(as.mutation(api.roles.update, { id, ...changes }), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const id = await insertRole(t);

    await expectErrorCode(t.mutation(api.roles.update, { id, ...changes }), "UNAUTHENTICATED");
  });
});

describe("roles.remove", () => {
  it("deletes a role nobody uses", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t);

    await as.mutation(api.roles.remove, { id });

    await expect(t.run((ctx) => ctx.db.get(id))).resolves.toBeNull();
  });

  it("refuses to delete a role that a user still has", async () => {
    const t = setupConvex();
    const { as, roleId } = await createUser(t, { permissions: ["role.manage"] });

    await expectErrorCode(as.mutation(api.roles.remove, { id: roleId }), "ROLE_IN_USE");
    await expect(t.run((ctx) => ctx.db.get(roleId))).resolves.not.toBeNull();
  });

  it("refuses to delete the system role", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t, { isSystem: true, key: "superAdmin" });

    await expectErrorCode(as.mutation(api.roles.remove, { id }), "SYSTEM_ROLE_LOCKED");
  });

  it("throws ROLE_NOT_FOUND for a deleted role", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["role.manage"] });
    const id = await insertRole(t);
    await t.run((ctx) => ctx.db.delete(id));

    await expectErrorCode(as.mutation(api.roles.remove, { id }), "ROLE_NOT_FOUND");
  });

  it("is forbidden without role.manage", async () => {
    const t = setupConvex();
    const { as } = await createUser(t, { permissions: ["user.manage"] });
    const id = await insertRole(t);

    await expectErrorCode(as.mutation(api.roles.remove, { id }), "FORBIDDEN");
  });

  it("rejects an unauthenticated caller", async () => {
    const t = setupConvex();
    const id = await insertRole(t);

    await expectErrorCode(t.mutation(api.roles.remove, { id }), "UNAUTHENTICATED");
  });
});
