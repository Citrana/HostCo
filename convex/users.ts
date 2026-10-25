import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { createCredentialUser, revokeAllSessions, setCredentialPassword } from "./lib/accounts";
import { isEmail, normalizeEmail } from "./lib/email";
import { appError } from "./lib/errors";
import { cleanPersonName } from "./lib/name";
import { canGrant, requirePermission } from "./lib/permissions";
import { generatePin, PIN_TTL_MS } from "./lib/pin";
import { rateLimiter } from "./rateLimits";

// Staff accounts are a short admin-managed list; this only bounds the reads.
const MAX_USERS = 500;
const MAX_ROLES = 200;

/** What the admin screens see of a user. Never the auth user id. */
function toAdminUser(user: Doc<"users">, role: Doc<"roles"> | null) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleName: role?.name ?? null,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    pinExpiresAt: user.pinExpiresAt,
  };
}

// The system role is never grantable by anyone else, even a custom role that
// lists every permission, so Super Admin accounts stay in Super Admin hands.
function canAssign(callerRole: Doc<"roles">, role: Doc<"roles">) {
  if (role.isSystem && !callerRole.isSystem) return false;
  return canGrant(callerRole, role.permissions);
}

async function getAssignableRole(ctx: QueryCtx, callerRole: Doc<"roles">, id: Id<"roles">) {
  const role = await ctx.db.get("roles", id);
  if (role === null) throw appError("ROLE_NOT_FOUND");
  if (!canAssign(callerRole, role)) throw appError("FORBIDDEN");
  return role;
}

/**
 * The target user and their role, if the caller could have assigned that role.
 * Otherwise managing them would hand the caller access they don't have (a PIN
 * reset, for one, gives the caller the account).
 */
async function getManageableUser(ctx: QueryCtx, callerRole: Doc<"roles">, id: Id<"users">) {
  const user = await ctx.db.get("users", id);
  if (user === null) throw appError("USER_NOT_FOUND");
  const role = await ctx.db.get("roles", user.roleId);
  if (role !== null && !canAssign(callerRole, role)) throw appError("FORBIDDEN");
  return { user, role };
}

/** Throws unless someone other than `user` remains an active Super Admin. */
async function assertAnotherActiveSuperAdmin(
  ctx: QueryCtx,
  user: Doc<"users">,
  role: Doc<"roles"> | null,
) {
  if (role === null || !role.isSystem || user.status !== "active") return;
  const holders = await ctx.db
    .query("users")
    .withIndex("by_roleId", (q) => q.eq("roleId", role._id))
    .take(MAX_USERS);
  if (!holders.some((holder) => holder._id !== user._id && holder.status === "active")) {
    throw appError("LAST_SUPER_ADMIN");
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "user.view");
    const roles = new Map(
      (await ctx.db.query("roles").take(MAX_ROLES)).map((role) => [role._id, role]),
    );
    const users = await ctx.db.query("users").order("desc").take(MAX_USERS);
    return users.map((user) => toAdminUser(user, roles.get(user.roleId) ?? null));
  },
});

export const get = query({
  // A string, not v.id: the id comes from the URL, and a malformed one should
  // read as "not found" rather than fail the page.
  args: { id: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "user.view");
    const id = ctx.db.normalizeId("users", args.id);
    const user = id === null ? null : await ctx.db.get("users", id);
    if (user === null) return null;
    return toAdminUser(user, await ctx.db.get("roles", user.roleId));
  },
});

/**
 * Creates a staff account with a one-time PIN. The PIN is only stored hashed,
 * as the account's password, and is returned here once for the admin to pass
 * on. The user must replace it within 72 hours.
 */
export const create = mutation({
  args: { name: v.string(), email: v.string(), roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const { user: caller, role: callerRole } = await requirePermission(ctx, "user.manage");
    const name = cleanPersonName(args.name);
    const email = normalizeEmail(args.email);
    if (!isEmail(email)) throw appError("EMAIL_INVALID");
    await getAssignableRole(ctx, callerRole, args.roleId);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing !== null) throw appError("EMAIL_TAKEN");

    const pin = generatePin();
    const authUserId = await createCredentialUser(ctx, { name, email, password: pin });
    const id = await ctx.db.insert("users", {
      authUserId,
      name,
      email,
      roleId: args.roleId,
      status: "active",
      mustChangePassword: true,
      pinExpiresAt: Date.now() + PIN_TTL_MS,
      createdBy: caller._id,
    });
    return { id, pin };
  },
});

export const update = mutation({
  args: { id: v.id("users"), name: v.string(), roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const { role: callerRole } = await requirePermission(ctx, "user.manage");
    const { user, role } = await getManageableUser(ctx, callerRole, args.id);
    const name = cleanPersonName(args.name);
    if (args.roleId !== user.roleId) {
      const newRole = await getAssignableRole(ctx, callerRole, args.roleId);
      if (!newRole.isSystem) await assertAnotherActiveSuperAdmin(ctx, user, role);
    }
    await ctx.db.patch("users", user._id, { name, roleId: args.roleId });
    return null;
  },
});

/** Disabling also signs the user out everywhere. */
export const setStatus = mutation({
  args: { id: v.id("users"), status: v.union(v.literal("active"), v.literal("disabled")) },
  handler: async (ctx, args) => {
    const { role: callerRole } = await requirePermission(ctx, "user.manage");
    const { user, role } = await getManageableUser(ctx, callerRole, args.id);
    if (user.status === args.status) return null;
    if (args.status === "disabled") {
      await assertAnotherActiveSuperAdmin(ctx, user, role);
      await revokeAllSessions(ctx, user.authUserId);
    }
    await ctx.db.patch("users", user._id, { status: args.status });
    return null;
  },
});

/**
 * For a forgotten password: replaces it with a new one-time PIN, signs the
 * user out everywhere and lifts any sign-in lockout, so the PIN works at once.
 */
export const resetPin = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const { user: caller, role: callerRole } = await requirePermission(ctx, "user.manage");
    // A stolen session could otherwise replace the password without knowing it.
    if (args.id === caller._id) throw appError("FORBIDDEN");
    const { user } = await getManageableUser(ctx, callerRole, args.id);

    const pin = generatePin();
    await setCredentialPassword(ctx, user.authUserId, pin);
    await ctx.db.patch("users", user._id, {
      mustChangePassword: true,
      pinExpiresAt: Date.now() + PIN_TTL_MS,
    });
    await revokeAllSessions(ctx, user.authUserId);
    await rateLimiter.reset(ctx, "failedSignIn", { key: user.email });
    await rateLimiter.reset(ctx, "failedPasswordChange", { key: user._id });
    return { pin };
  },
});
