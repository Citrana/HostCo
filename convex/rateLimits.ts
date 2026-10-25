import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Per email, on top of Better Auth's per-IP limit, so spreading attempts over
// many IPs doesn't help a password guesser.
export const SIGN_IN_ATTEMPTS_PER_EMAIL = 5;

const rateLimiter = new RateLimiter(components.rateLimiter, {
  signInByEmail: { kind: "fixed window", rate: SIGN_IN_ATTEMPTS_PER_EMAIL, period: 15 * MINUTE },
});

/** Counts one sign-in attempt for the email; false once the limit is reached. */
export const consumeSignInAttempt = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const { ok } = await rateLimiter.limit(ctx, "signInByEmail", {
      key: args.email.trim().toLowerCase(),
    });
    return ok;
  },
});
