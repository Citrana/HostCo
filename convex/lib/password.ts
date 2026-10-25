import type { ErrorCode } from "./errors";

export const PASSWORD_MIN_LENGTH = 10;
// Long enough for passphrases, short enough to keep hashing cheap.
export const PASSWORD_MAX_LENGTH = 128;

export function passwordProblem(password: string): ErrorCode | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "PASSWORD_TOO_SHORT";
  if (password.length > PASSWORD_MAX_LENGTH) return "PASSWORD_TOO_LONG";
  return null;
}
