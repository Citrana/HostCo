import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { vi } from "vitest";
import { AuthClientContext, type AuthClient } from "@/lib/auth/client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

export const LOCALES = [
  ["fr", fr],
  ["en", en],
] as const;

export type Locale = (typeof LOCALES)[number][0];

export function fakeAuthClient(overrides: Partial<AuthClient> = {}) {
  return {
    signIn: vi.fn<AuthClient["signIn"]>().mockResolvedValue({ ok: true }),
    signOut: vi.fn<AuthClient["signOut"]>().mockResolvedValue(undefined),
    ...overrides,
  };
}

export function renderWithAuth(
  ui: ReactElement,
  { locale = "fr", auth = fakeAuthClient() }: { locale?: Locale; auth?: AuthClient } = {},
) {
  const messages = locale === "fr" ? fr : en;
  const result = render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AuthClientContext value={auth}>{ui}</AuthClientContext>
    </NextIntlClientProvider>,
  );
  return { ...result, auth, messages };
}
