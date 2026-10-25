import { ConvexError } from "convex/values";

// Convex sends these codes, never display text. The client translates them
// through `Errors.<code>` in messages/*.json.
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ACCOUNT_DISABLED",
  "PASSWORD_CHANGE_REQUIRED",
  "ROLE_NOT_FOUND",
  "ROLE_IN_USE",
  "ROLE_INVALID",
  "SYSTEM_ROLE_LOCKED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function appError(code: ErrorCode) {
  return new ConvexError({ code });
}
