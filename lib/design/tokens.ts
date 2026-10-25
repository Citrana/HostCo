// Colors taken from docs/design/inspiration.png. app/globals.css mirrors these
// values; tokens.test.ts fails if the two drift apart.
export const colors = {
  primary: "#2B4BEB",
  "primary-hover": "#2440D4",
  "primary-soft": "#EEF2FF",
  "on-primary": "#FFFFFF",
  surface: "#FFFFFF",
  canvas: "#F5F6F8",
  ink: "#111827",
  muted: "#5B6270",
  border: "#E5E7EB",
  "border-strong": "#7C8493",
  // Star icons only, always next to a text rating: too light for text.
  rating: "#F5B400",
  "badge-green": "#1E7A3E",
  "badge-green-soft": "#EAF7EE",
  "badge-amber": "#8A6100",
  "badge-amber-soft": "#FFF6DD",
} as const;

export type ColorToken = keyof typeof colors;

// Text on background pairs that must meet WCAG AA (4.5:1).
export const textPairs: ReadonlyArray<readonly [ColorToken, ColorToken]> = [
  ["ink", "surface"],
  ["ink", "canvas"],
  ["muted", "surface"],
  ["muted", "canvas"],
  ["primary", "surface"],
  ["primary", "canvas"],
  ["primary", "primary-soft"],
  ["primary-hover", "primary-soft"],
  ["on-primary", "primary"],
  ["on-primary", "primary-hover"],
  ["badge-green", "badge-green-soft"],
  ["badge-amber", "badge-amber-soft"],
];

// UI component boundaries (form fields) that must meet WCAG AA (3:1).
export const uiPairs: ReadonlyArray<readonly [ColorToken, ColorToken]> = [
  ["border-strong", "surface"],
  ["border-strong", "canvas"],
  ["primary", "surface"],
];
