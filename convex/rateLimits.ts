import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { isEmail, normalizeEmail } from "./lib/email";

export const FAILED_ATTEMPTS_ALLOWED = 5;
const WINDOW = 15 * MINUTE;
// RFC 5321's limit; anything longer can't be an account, so it never becomes a key.
const MAX_EMAIL_LENGTH = 254;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Per email, on top of Better Auth's per-IP limit, so spreading attempts over
  // many IPs doesn't help a password guesser. Each attempt takes a token before
  // the password is checked, and a successful sign-in gives them all back, so
  // signing in often never locks anyone out.
  failedSignIn: { kind: "fixed window", rate: FAILED_ATTEMPTS_ALLOWED, period: WINDOW },
  // Per user: a stolen session can't be used to guess the current password.
  failedPasswordChange: { kind: "fixed window", rate: FAILED_ATTEMPTS_ALLOWED, period: WINDOW },
});

/** The limiter key for a sign-in email, or null when it can't be an account. */
export function signInLimitKey(email: unknown): string | null {
  if (typeof email !== "string" || email.length > MAX_EMAIL_LENGTH) return null;
  const normalized = normalizeEmail(email);
  return isEmail(normalized) ? normalized : null;
}

/**
 * Takes one attempt from the email's budget, or reports that none are left.
 * Checking and counting in one mutation keeps parallel guesses from all
 * passing the check before any failure is recorded.
 */
export const takeSignInAttempt = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const { ok } = await rateLimiter.limit(ctx, "failedSignIn", { key: args.key });
    return ok;
  },
});

/** After a successful sign-in, the email's attempts no longer count. */
export const clearSignInAttempts = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await rateLimiter.reset(ctx, "failedSignIn", { key: args.key });
    return null;
  },
});
