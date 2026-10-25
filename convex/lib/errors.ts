import { ConvexError } from "convex/values";

// Convex sends these codes, never display text. The client translates them
// through `Errors.<code>` in messages/*.json.
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "ACCOUNT_DISABLED",
  "PASSWORD_CHANGE_REQUIRED",
  "INVALID_CREDENTIALS",
  "PIN_EXPIRED",
  "TOO_MANY_ATTEMPTS",
  "SETUP_ALREADY_DONE",
  "EMAIL_TAKEN",
  "EMAIL_INVALID",
  "NAME_INVALID",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_REUSED",
  "ROLE_NOT_FOUND",
  "ROLE_IN_USE",
  "ROLE_INVALID",
  "SYSTEM_ROLE_LOCKED",
  "USER_NOT_FOUND",
  "LAST_SUPER_ADMIN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function appError(code: ErrorCode) {
  return new ConvexError({ code });
}
