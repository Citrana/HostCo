import { ConvexError } from "convex/values";
import { ERROR_CODES, type ErrorCode } from "@/convex/lib/errors";

// Every code the UI can show: the server's codes plus a fallback for anything
// unexpected (network failures, bugs). Each one has an `Errors.<code>` message.
export const CLIENT_ERROR_CODES = [...ERROR_CODES, "UNKNOWN"] as const;

export type ClientErrorCode = ErrorCode | "UNKNOWN";

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

/** Turns a Convex or Better Auth error into a code the UI can translate. */
export function toErrorCode(error: unknown): ClientErrorCode {
  if (error instanceof ConvexError) {
    const code: unknown = (error.data as { code?: unknown } | null)?.code;
    return isErrorCode(code) ? code : "UNKNOWN";
  }
  if (typeof error !== "object" || error === null) return "UNKNOWN";

  const { code, status } = error as { code?: unknown; status?: unknown };
  if (isErrorCode(code)) return code;
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "INVALID_CREDENTIALS";
  // Better Auth's own per-IP limiter answers 429 without one of our codes.
  if (status === 429) return "TOO_MANY_ATTEMPTS";
  return "UNKNOWN";
}
