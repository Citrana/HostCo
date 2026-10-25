import { describe, expect, it } from "vitest";
import { generatePin, PIN_LENGTH, PIN_TTL_MS, signInBlockReason } from "./pin";

describe("generatePin", () => {
  it("returns 8 digits", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePin()).toMatch(/^\d{8}$/);
    }
    expect(PIN_LENGTH).toBe(8);
  });

  it("skips random bytes that would bias the digits", () => {
    // 250..255 fall outside the largest multiple of 10 and must be redrawn.
    const bytes = [255, 250, 3, 17, 29, 41, 53, 65, 77, 89, 91];
    const random = (array: Uint8Array) => {
      for (let i = 0; i < array.length; i += 1) array[i] = bytes.shift() ?? 0;
      return array;
    };

    expect(generatePin(random)).toBe("37913579");
  });

  it("uses every digit with roughly equal frequency", () => {
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 2000; i += 1) {
      for (const digit of generatePin()) counts[Number(digit)] += 1;
    }
    // 16 000 digits, 1 600 expected each; a fair generator stays well inside ±20%.
    for (const count of counts) {
      expect(count).toBeGreaterThan(1280);
      expect(count).toBeLessThan(1920);
    }
  });
});

describe("PIN_TTL_MS", () => {
  it("is 72 hours", () => {
    expect(PIN_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });
});

describe("signInBlockReason", () => {
  const now = 1_000_000;
  const active = { status: "active" as const, mustChangePassword: false, pinExpiresAt: null };

  it("lets an active user sign in", () => {
    expect(signInBlockReason(active, now)).toBeNull();
  });

  it("lets a user sign in with a PIN that hasn't expired", () => {
    expect(
      signInBlockReason({ ...active, mustChangePassword: true, pinExpiresAt: now + 1 }, now),
    ).toBeNull();
  });

  it("rejects a PIN that has expired", () => {
    expect(
      signInBlockReason({ ...active, mustChangePassword: true, pinExpiresAt: now }, now),
    ).toBe("PIN_EXPIRED");
  });

  it("ignores an old expiry once the password was changed", () => {
    expect(signInBlockReason({ ...active, pinExpiresAt: now - 1 }, now)).toBeNull();
  });

  it("rejects a disabled account", () => {
    expect(signInBlockReason({ ...active, status: "disabled" }, now)).toBe("ACCOUNT_DISABLED");
  });

  it("rejects an auth user without a profile", () => {
    expect(signInBlockReason(null, now)).toBe("INVALID_CREDENTIALS");
  });
});
