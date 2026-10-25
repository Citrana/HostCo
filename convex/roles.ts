import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { appError } from "./lib/errors";
import {
  permissionValidator,
  requireAnyPermission,
  requirePermission,
  type Permission,
} from "./lib/permissions";
import { localized } from "./schema";

const MAX_NAME_LENGTH = 60;
// Roles are a short admin-managed list; this only bounds the read.
const MAX_ROLES = 200;

const roleFields = {
  name: localized,
  permissions: v.array(permissionValidator),
};

function cleanRole(args: { name: { fr: string; en: string }; permissions: Permission[] }) {
  const name = { fr: args.name.fr.trim(), en: args.name.en.trim() };
  const valid = [name.fr, name.en].every(
    (value) => value.length > 0 && value.length <= MAX_NAME_LENGTH,
  );
  if (!valid) throw appError("ROLE_INVALID");
  return { name, permissions: [...new Set(args.permissions)] };
}

// Without this, `role.manage` would be a path to every other permission.
function assertCanGrant(callerRole: Doc<"roles">, permissions: readonly Permission[]) {
  if (callerRole.isSystem) return;
  if (!permissions.every((permission) => callerRole.permissions.includes(permission))) {
    throw appError("FORBIDDEN");
  }
}

async function getEditableRole(ctx: MutationCtx, id: Id<"roles">, callerRole: Doc<"roles">) {
  const role = await ctx.db.get("roles", id);
  if (role === null) throw appError("ROLE_NOT_FOUND");
  if (role.isSystem) throw appError("SYSTEM_ROLE_LOCKED");
  // Nobody widens or deletes the role they act with.
  if (role._id === callerRole._id) throw appError("FORBIDDEN");
  return role;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAnyPermission(ctx, ["user.view", "role.manage"]);
    return await ctx.db.query("roles").take(MAX_ROLES);
  },
});

export const get = query({
  args: { id: v.id("roles") },
  handler: async (ctx, args) => {
    await requireAnyPermission(ctx, ["user.view", "role.manage"]);
    return await ctx.db.get("roles", args.id);
  },
});

export const create = mutation({
  args: roleFields,
  handler: async (ctx, args) => {
    const { role } = await requirePermission(ctx, "role.manage");
    const cleaned = cleanRole(args);
    assertCanGrant(role, cleaned.permissions);
    return await ctx.db.insert("roles", { ...cleaned, key: null, isSystem: false });
  },
});

export const update = mutation({
  args: { id: v.id("roles"), ...roleFields },
  handler: async (ctx, args) => {
    const { role } = await requirePermission(ctx, "role.manage");
    await getEditableRole(ctx, args.id, role);
    const cleaned = cleanRole(args);
    assertCanGrant(role, cleaned.permissions);
    await ctx.db.patch("roles", args.id, cleaned);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("roles") },
  handler: async (ctx, args) => {
    const { role } = await requirePermission(ctx, "role.manage");
    await getEditableRole(ctx, args.id, role);
    const holder = await ctx.db
      .query("users")
      .withIndex("by_roleId", (q) => q.eq("roleId", args.id))
      .first();
    if (holder !== null) throw appError("ROLE_IN_USE");
    await ctx.db.delete("roles", args.id);
    return null;
  },
});
