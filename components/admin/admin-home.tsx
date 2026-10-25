"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { useAuthClient } from "@/lib/auth/client";
import { useOpenPage } from "@/lib/navigation/open-page";
import { FormError } from "../auth/form-parts";

/** Landing page after sign-in. PR 4 replaces it with the admin shell. */
export function AdminHome() {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const currentLocale = useLocale();
  const locale = hasLocale(routing.locales, currentLocale) ? currentLocale : routing.defaultLocale;
  const auth = useAuthClient();
  const router = useRouter();
  const openPage = useOpenPage();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");

  const [signOutFailed, setSignOutFailed] = useState(false);

  const signedOut = !isLoading && !isAuthenticated;
  // Signed in, but the account is disabled or gone: end the session too.
  const inactive = me === null;
  const mustChange = me?.mustChangePassword === true;
  useEffect(() => {
    if (signedOut) router.replace("/sign-in");
    else if (inactive) {
      // Leave either way; a failed sign-out only leaves a dead cookie behind.
      void auth
        .signOut()
        .catch(() => undefined)
        .then(() => openPage("/sign-in"));
    } else if (mustChange) router.replace("/change-password");
  }, [signedOut, inactive, mustChange, auth, router, openPage]);

  async function signOut() {
    setSignOutFailed(false);
    try {
      await auth.signOut();
    } catch {
      setSignOutFailed(true);
      return;
    }
    // A full load, so no route Next keeps hidden survives with this user's state.
    openPage("/sign-in");
  }

  if (me === undefined || me === null || mustChange) {
    return (
      <main className="flex flex-1 items-center justify-center bg-canvas px-4">
        <p className="text-sm text-muted">{t("loading")}</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <section className="flex w-full max-w-md flex-col gap-4 rounded-card bg-surface p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-ink">{t("Admin.welcome", { name: me.name })}</h1>
        {me.roleName && (
          <p className="text-sm text-muted">{t("Admin.role", { role: me.roleName[locale] })}</p>
        )}
        <FormError message={signOutFailed ? tErrors("UNKNOWN") : null} />
        <button
          type="button"
          onClick={signOut}
          className="h-12 self-start rounded-full bg-primary-soft px-6 text-base font-medium text-primary transition-colors hover:bg-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t("Admin.signOut")}
        </button>
      </section>
    </main>
  );
}
