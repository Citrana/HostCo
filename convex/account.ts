import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { changeOwnPassword } from "./lib/accounts";
import { appError } from "./lib/errors";
import { passwordProblem } from "./lib/password";
import { requireUser } from "./lib/permissions";
import { signInBlockReason } from "./lib/pin";

/** The signed-in user, including while they must still change their password. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const role = await ctx.db.get("roles", user.roleId);
    return {
      name: user.name,
      email: user.email,
      roleName: role?.name ?? null,
      mustChangePassword: user.mustChangePassword,
    };
  },
});

/**
 * Sets a new password and clears the forced-change flag in the same
 * transaction, so the flag can only clear after a successful change.
 */
export const changePassword = mutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const problem = passwordProblem(args.newPassword);
    if (problem !== null) throw appError(problem);
    // While the flag is set, the current password is the PIN.
    if (args.newPassword === args.currentPassword) throw appError("PASSWORD_REUSED");

    await changeOwnPassword(ctx, args);
    await ctx.db.patch("users", user._id, { mustChangePassword: false, pinExpiresAt: null });
    return null;
  },
});

/** Used by the session-create hook in convex/auth.ts. */
export const signInCheck = internalQuery({
  args: { authUserId: v.string(), now: v.number() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    return signInBlockReason(profile, args.now);
  },
});
