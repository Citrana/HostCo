import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getAuthUserId } from "./auth";
import { appError } from "./errors";

export const PERMISSIONS = [
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
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const permissionValidator = v.union(
  ...PERMISSIONS.map((permission) => v.literal(permission)),
);

/** The caller's profile, whatever its status, or null when signed out. */
export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId === null) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique();
}

/**
 * Resolves the caller's active profile from the server-side identity. Unlike
 * `requirePermission`, it lets through users who must still change their
 * password, so the change-password flow can use it.
 */
export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) throw appError("UNAUTHENTICATED");
  if (user.status === "disabled") throw appError("ACCOUNT_DISABLED");
  return user;
}

/**
 * Resolves the caller from the server-side identity and checks that their role
 * holds at least one of `permissions`. Never trust a user id passed in args.
 */
export async function requireAnyPermission(
  ctx: QueryCtx,
  permissions: readonly Permission[],
): Promise<{ user: Doc<"users">; role: Doc<"roles"> }> {
  const user = await requireUser(ctx);
  if (user.mustChangePassword) throw appError("PASSWORD_CHANGE_REQUIRED");

  const role = await ctx.db.get("roles", user.roleId);
  if (role === null) throw appError("FORBIDDEN");

  const allowed =
    role.isSystem || permissions.some((permission) => role.permissions.includes(permission));
  if (!allowed) throw appError("FORBIDDEN");

  return { user, role };
}

export async function requirePermission(ctx: QueryCtx, permission: Permission) {
  return await requireAnyPermission(ctx, [permission]);
}
