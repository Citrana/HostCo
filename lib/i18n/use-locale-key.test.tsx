import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useLocaleKey } from "./use-locale-key";

function inLocale(locale: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

describe("useLocaleKey", () => {
  it.each(["fr", "en"])("returns %s as is", (locale) => {
    const { result } = renderHook(useLocaleKey, { wrapper: inLocale(locale) });

    expect(result.current).toBe(locale);
  });

  it("falls back to French for a locale the app doesn't support", () => {
    const { result } = renderHook(useLocaleKey, { wrapper: inLocale("de") });

    expect(result.current).toBe("fr");
  });
});
