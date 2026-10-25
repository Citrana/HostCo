"use client";

import { useLocale } from "next-intl";
import { useCallback } from "react";
import { getPathname } from "@/i18n/navigation";

/**
 * Loads a localized page with a full navigation instead of a client-side one.
 * Used right after sign-in: the auth provider then starts from the new session
 * cookie, instead of briefly reporting "signed out" while Better Auth refreshes
 * its session in the background.
 */
export function useOpenPage() {
  const locale = useLocale();
  // Stable, so effects that depend on it don't re-run on every render.
  return useCallback(
    (href: string) => window.location.assign(getPathname({ href, locale })),
    [locale],
  );
}
