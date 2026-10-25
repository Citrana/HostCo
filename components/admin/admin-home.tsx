"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "@/i18n/navigation";
import { useAuthClient } from "@/lib/auth/client";

/** Landing page after sign-in. PR 4 replaces it with the admin shell. */
export function AdminHome() {
  const t = useTranslations("Auth");
  const locale = useLocale() as "fr" | "en";
  const auth = useAuthClient();
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");

  const signedOut = !isLoading && !isAuthenticated;
  const mustChange = me?.mustChangePassword === true;
  useEffect(() => {
    if (signedOut) router.replace("/sign-in");
    else if (mustChange) router.replace("/change-password");
  }, [signedOut, mustChange, router]);

  async function signOut() {
    await auth.signOut();
    router.replace("/sign-in");
  }

  if (me === undefined || mustChange) {
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
