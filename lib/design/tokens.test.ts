import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { colors } from "./tokens";

const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

function cssColors(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, value] of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6});/gi)) {
    found[name] = value.toUpperCase();
  }
  return found;
}

describe("globals.css color tokens", () => {
  it("match lib/design/tokens.ts exactly", () => {
    const expected = Object.fromEntries(
      Object.entries(colors).map(([name, value]) => [name, value.toUpperCase()]),
    );

    expect(cssColors()).toEqual(expected);
  });

  it("remove the default Tailwind palette", () => {
    expect(css).toMatch(/--color-\*:\s*initial;/);
  });
});
