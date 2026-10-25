import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("accepts a password of at least 10 characters", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(passwordProblem("a".repeat(10))).toBeNull();
  });

  it("rejects a password shorter than 10 characters", () => {
    expect(passwordProblem("a".repeat(9))).toBe("PASSWORD_TOO_SHORT");
  });

  it("rejects a password longer than the maximum", () => {
    expect(passwordProblem("a".repeat(PASSWORD_MAX_LENGTH + 1))).toBe("PASSWORD_TOO_LONG");
  });
});
