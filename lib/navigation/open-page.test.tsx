import { renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

const { useOpenPage } = await import("./open-page");

describe("useOpenPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(["fr", "en"])("loads the localized page in %s", (locale) => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign });
    const { result } = renderHook(() => useOpenPage(), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale={locale} messages={{}}>
          {children}
        </NextIntlClientProvider>
      ),
    });

    result.current("/admin");

    expect(assign).toHaveBeenCalledWith(`/${locale}/admin`);
  });

  it("returns the same function across renders", () => {
    const { result, rerender } = renderHook(() => useOpenPage(), {
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="fr" messages={{}}>
          {children}
        </NextIntlClientProvider>
      ),
    });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});
