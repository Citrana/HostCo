import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createCredentialUser } from "./lib/accounts";
import { isEmail, normalizeEmail } from "./lib/email";
import { appError } from "./lib/errors";
import { cleanPersonName } from "./lib/name";
import { passwordProblem } from "./lib/password";
import { ensureDefaultRoles } from "./seed";

/** Public: the setup page is only usable while no user exists. */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const anyUser = await ctx.db.query("users").first();
    return { needed: anyUser === null };
  },
});

/**
 * Public, but only works once: creates the first Super Admin while the users
 * table is empty. The emptiness check, the auth account and the profile are one
 * transaction, so two racing calls can't both succeed.
 */
export const bootstrapSuperAdmin = mutation({
  args: { name: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    if ((await ctx.db.query("users").first()) !== null) throw appError("SETUP_ALREADY_DONE");

    const name = cleanPersonName(args.name);
    const email = normalizeEmail(args.email);
    if (!isEmail(email)) throw appError("EMAIL_INVALID");
    const problem = passwordProblem(args.password);
    if (problem !== null) throw appError(problem);

    const roleId = await ensureDefaultRoles(ctx);
    const authUserId = await createCredentialUser(ctx, { name, email, password: args.password });
    await ctx.db.insert("users", {
      authUserId,
      name,
      email,
      roleId,
      status: "active",
      mustChangePassword: false,
      pinExpiresAt: null,
      createdBy: null,
    });
    return null;
  },
});
