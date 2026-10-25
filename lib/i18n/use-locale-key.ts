"use client";

import { hasLocale, useLocale } from "next-intl";
import { routing } from "@/i18n/routing";

export type Locale = (typeof routing.locales)[number];

/** The current locale, narrowed to a key of localized fields like `{ fr, en }`. */
export function useLocaleKey(): Locale {
  const locale = useLocale();
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
