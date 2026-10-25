import type { Doc } from "../_generated/dataModel";
import type { ErrorCode } from "./errors";

export const PIN_LENGTH = 8;
export const PIN_TTL_MS = 72 * 60 * 60 * 1000;

// 250 is the largest multiple of 10 that fits in a byte; bytes from 250 to 255
// are redrawn so every digit is equally likely.
const UNBIASED_BYTE_LIMIT = 250;

type RandomFill = (array: Uint8Array) => Uint8Array;

const cryptoFill: RandomFill = (array) => crypto.getRandomValues(array);

/**
 * A one-time PIN of 8 random digits. It is only ever handed to Better Auth as
 * the user's password (which hashes it) and shown once to the admin.
 */
export function generatePin(random: RandomFill = cryptoFill): string {
  let pin = "";
  while (pin.length < PIN_LENGTH) {
    for (const byte of random(new Uint8Array(PIN_LENGTH))) {
      if (byte < UNBIASED_BYTE_LIMIT && pin.length < PIN_LENGTH) pin += String(byte % 10);
    }
  }
  return pin;
}

type SignInProfile = Pick<Doc<"users">, "status" | "mustChangePassword" | "pinExpiresAt">;

/** Why a user with valid credentials still may not start a session, if at all. */
export function signInBlockReason(profile: SignInProfile | null, now: number): ErrorCode | null {
  // Every auth user gets a profile in the same transaction, so this only
  // happens for leftovers; answer like a wrong password.
  if (profile === null) return "INVALID_CREDENTIALS";
  if (profile.status === "disabled") return "ACCOUNT_DISABLED";
  if (profile.mustChangePassword && profile.pinExpiresAt !== null && profile.pinExpiresAt <= now) {
    return "PIN_EXPIRED";
  }
  return null;
}
