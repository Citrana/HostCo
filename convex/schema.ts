import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { permissionValidator } from "./lib/permissions";

export const localized = v.object({ fr: v.string(), en: v.string() });

export default defineSchema({
  roles: defineTable({
    // "superAdmin" etc. for seeded roles, null for roles created by admins.
    key: v.union(v.string(), v.null()),
    name: localized,
    permissions: v.array(permissionValidator),
    // Super Admin: locked, holds every permission, can't be edited or deleted.
    isSystem: v.boolean(),
  }).index("by_key", ["key"]),

  // App profile, 1:1 with the auth user.
  users: defineTable({
    authUserId: v.string(),
    name: v.string(),
    email: v.string(),
    roleId: v.id("roles"),
    status: v.union(v.literal("active"), v.literal("disabled")),
    mustChangePassword: v.boolean(),
    pinExpiresAt: v.union(v.number(), v.null()),
    // null only for the bootstrap Super Admin.
    createdBy: v.union(v.id("users"), v.null()),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"])
    .index("by_roleId", ["roleId"]),
});
