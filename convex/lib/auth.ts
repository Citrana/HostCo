import type { QueryCtx } from "../_generated/server";

// The only place that turns the request's identity into an auth user id.
// convex/auth.ts configures Better Auth and convex/lib/accounts.ts runs its
// account operations; nothing else touches the auth provider.

/** The Better Auth user id of the caller. The Convex plugin puts it in `subject`. */
export async function getAuthUserId(ctx: QueryCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}
