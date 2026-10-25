import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/convex/lib/errors";
import en from "./en.json";
import fr from "./fr.json";

describe("error messages", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("translates every Convex error code in %s", (_locale, messages) => {
    const errors: Record<string, string> = messages.Errors;

    expect(ERROR_CODES.filter((code) => !errors[code])).toEqual([]);
  });
});
