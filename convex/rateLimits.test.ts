import { describe, expect, it } from "vitest";
import { signInLimitKey } from "./rateLimits";

describe("signInLimitKey", () => {
  it("normalizes the email", () => {
    expect(signInLimitKey(" Amani@Example.com ")).toBe("amani@example.com");
  });

  it.each([undefined, 42, "not-an-email", `${"a".repeat(250)}@example.com`])(
    "ignores %j, which can't be an account",
    (email) => {
      expect(signInLimitKey(email)).toBeNull();
    },
  );
});
