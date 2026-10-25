import { describe, expect, it } from "vitest";
import { isEmail, normalizeEmail } from "./email";

describe("email helpers", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Amani@Example.COM ")).toBe("amani@example.com");
  });

  it.each(["a@b.cd", "first.last@sub.example.org"])("accepts %s", (email) => {
    expect(isEmail(email)).toBe(true);
  });

  it.each(["", "plain", "a@b", "a b@c.de", "@c.de"])("rejects %j", (email) => {
    expect(isEmail(email)).toBe(false);
  });
});
