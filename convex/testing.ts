import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Better Auth models that hold per-user or per-request data. `jwks` (the
// signing keys) is kept so existing deployments don't rotate keys on reset.
const AUTH_MODELS = ["session", "account", "verification", "rateLimit", "user"] as const;
// The e2e runs create a handful of rows; one page per table is plenty.
const PAGE = { numItems: 1000, cursor: null };

/**
 * Wipes users, roles and auth data before an e2e run, so `/setup` works again.
 * Internal, and refuses to run unless the deployment has IS_TEST=true.
 * Run it with `pnpm exec convex run testing:reset`.
 */
export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (process.env.IS_TEST !== "true") {
      throw new Error("testing:reset only runs on deployments with IS_TEST=true");
    }
    for (const table of ["users", "roles"] as const) {
      for (const doc of await ctx.db.query(table).take(PAGE.numItems)) {
        await ctx.db.delete(table, doc._id);
      }
    }
    for (const model of AUTH_MODELS) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model },
        paginationOpts: PAGE,
      });
    }
    return null;
  },
});
