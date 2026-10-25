import { describe, expect, it } from "vitest";
import en from "./en.json";
import fr from "./fr.json";

type Messages = { [key: string]: string | Messages };

function flattenKeys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

describe("translation files", () => {
  it("have exactly the same keys in French and English", () => {
    const frKeys = flattenKeys(fr).sort();
    const enKeys = flattenKeys(en).sort();

    expect(frKeys.filter((key) => !enKeys.includes(key))).toEqual([]);
    expect(enKeys.filter((key) => !frKeys.includes(key))).toEqual([]);
  });

  it("have no empty translations", () => {
    const empty = [fr, en].flatMap((messages) =>
      flattenKeys(messages).filter((path) => {
        const value = path
          .split(".")
          .reduce<string | Messages>((node, key) => (node as Messages)[key], messages);
        return typeof value === "string" && value.trim() === "";
      }),
    );

    expect(empty).toEqual([]);
  });
});
