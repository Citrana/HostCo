import type { QueryCtx } from "../_generated/server";

// The only place that turns the request's identity into an auth user id, so
// swapping or extending the auth provider stays a change to this file.
export async function getAuthUserId(ctx: QueryCtx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}
