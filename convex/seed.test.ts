import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { PERMISSIONS } from "./lib/permissions";
import { setupConvex } from "./test.helpers";

// The approved default matrix from .claude/plans/hostco-mvp.plan.md, written out
// on purpose instead of imported so the test catches drift in the seed.
const expectedMatrix = {
  superAdmin: [...PERMISSIONS],
  platformManager: [
    "property.create",
    "property.update.own",
    "property.update.any",
    "property.delete",
    "property.publish",
    "property.view.any",
    "user.view",
    "location.manage",
  ],
  contentManager: ["property.create", "property.update.own", "property.view.any"],
  moderator: ["property.view.any", "property.update.any", "property.publish"],
  verificationOfficer: ["property.view.any", "property.publish"],
  supportAgent: ["property.view.any", "user.view"],
  financeManager: ["property.view.any"],
};

async function readRoles(t: ReturnType<typeof setupConvex>) {
  return await t.run((ctx) => ctx.db.query("roles").collect());
}

describe("seed.seedRoles", () => {
  it("creates the seven default roles with the approved permissions", async () => {
    const t = setupConvex();

    await t.mutation(internal.seed.seedRoles, {});

    const roles = await readRoles(t);
    const matrix = Object.fromEntries(
      roles.map((role) => [role.key, [...role.permissions].sort()]),
    );
    expect(matrix).toEqual(
      Object.fromEntries(
        Object.entries(expectedMatrix).map(([key, permissions]) => [key, [...permissions].sort()]),
      ),
    );
  });

  it("marks only Super Admin as the system role", async () => {
    const t = setupConvex();

    await t.mutation(internal.seed.seedRoles, {});

    const roles = await readRoles(t);
    expect(roles.filter((role) => role.isSystem).map((role) => role.key)).toEqual(["superAdmin"]);
  });

  it("names every role in French and English", async () => {
    const t = setupConvex();

    await t.mutation(internal.seed.seedRoles, {});

    for (const role of await readRoles(t)) {
      expect(role.name.fr.trim()).not.toBe("");
      expect(role.name.en.trim()).not.toBe("");
    }
  });

  it("is idempotent", async () => {
    const t = setupConvex();

    await t.mutation(internal.seed.seedRoles, {});
    const first = await readRoles(t);
    await t.mutation(internal.seed.seedRoles, {});

    expect(await readRoles(t)).toEqual(first);
  });

  it("keeps an admin's edits to a seeded role", async () => {
    const t = setupConvex();
    await t.mutation(internal.seed.seedRoles, {});
    const moderator = (await readRoles(t)).find((role) => role.key === "moderator")!;
    await t.run((ctx) => ctx.db.patch(moderator._id, { permissions: ["property.view.any"] }));

    await t.mutation(internal.seed.seedRoles, {});

    const after = await t.run((ctx) => ctx.db.get(moderator._id));
    expect(after?.permissions).toEqual(["property.view.any"]);
  });

  it("gives Super Admin every permission again", async () => {
    const t = setupConvex();
    await t.mutation(internal.seed.seedRoles, {});
    const superAdmin = (await readRoles(t)).find((role) => role.key === "superAdmin")!;
    await t.run((ctx) => ctx.db.patch(superAdmin._id, { permissions: [] }));

    await t.mutation(internal.seed.seedRoles, {});

    const after = await t.run((ctx) => ctx.db.get(superAdmin._id));
    expect([...(after?.permissions ?? [])].sort()).toEqual([...PERMISSIONS].sort());
  });
});
