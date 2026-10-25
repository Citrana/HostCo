import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { toErrorCode } from "./errors";

describe("toErrorCode", () => {
  it("reads the code of a Convex error", () => {
    expect(toErrorCode(new ConvexError({ code: "SETUP_ALREADY_DONE" }))).toBe("SETUP_ALREADY_DONE");
  });

  it("passes through our codes sent by the auth hooks", () => {
    expect(toErrorCode({ code: "PIN_EXPIRED", status: 403 })).toBe("PIN_EXPIRED");
  });

  it("maps a wrong email or password to INVALID_CREDENTIALS", () => {
    expect(toErrorCode({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe(
      "INVALID_CREDENTIALS",
    );
  });

  it("maps any 429 to TOO_MANY_ATTEMPTS", () => {
    expect(toErrorCode({ status: 429, message: "Too many requests." })).toBe("TOO_MANY_ATTEMPTS");
  });

  it("falls back to UNKNOWN for anything else", () => {
    expect(toErrorCode(new Error("network down"))).toBe("UNKNOWN");
    expect(toErrorCode(new ConvexError({ code: "NOT_A_REAL_CODE" }))).toBe("UNKNOWN");
    expect(toErrorCode({ code: "SOMETHING_ELSE", status: 500 })).toBe("UNKNOWN");
    expect(toErrorCode(null)).toBe("UNKNOWN");
  });
});
