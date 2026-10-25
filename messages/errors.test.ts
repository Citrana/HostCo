import { describe, expect, it } from "vitest";
import { CLIENT_ERROR_CODES } from "@/lib/auth/errors";
import en from "./en.json";
import fr from "./fr.json";

describe("error messages", () => {
  it.each([
    ["fr", fr],
    ["en", en],
  ])("translates every error code the client can show in %s", (_locale, messages) => {
    const errors: Record<string, string> = messages.Errors;

    expect(CLIENT_ERROR_CODES.filter((code) => !errors[code])).toEqual([]);
  });
});
