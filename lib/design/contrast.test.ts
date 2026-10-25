import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { colors, textPairs, uiPairs } from "./tokens";

describe("contrastRatio", () => {
  it("gives 21 for black on white and 1 for identical colors", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#2B4BEB", "#2b4beb")).toBeCloseTo(1, 5);
  });

  it("does not depend on argument order", () => {
    expect(contrastRatio("#FFFFFF", "#111827")).toBeCloseTo(
      contrastRatio("#111827", "#FFFFFF"),
      10,
    );
  });

  it("rejects values that are not #RRGGBB", () => {
    expect(() => contrastRatio("#FFF", "#000000")).toThrow(/#RRGGBB/);
    expect(() => contrastRatio("red", "#000000")).toThrow(/#RRGGBB/);
  });
});

describe("design tokens", () => {
  it.each(textPairs)("%s text on %s meets WCAG AA (4.5:1)", (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(uiPairs)("%s on %s meets WCAG AA for UI (3:1)", (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3);
  });
});
