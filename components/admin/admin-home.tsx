"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useLocaleKey } from "@/lib/i18n/use-locale-key";
import { can, useAdminMe } from "./admin-session";
import { NAV_ITEMS } from "./admin-shell";

/** The team area's landing page: a greeting and the sections the role allows. */
export function AdminHome() {
  const t = useTranslations("Admin");
  const locale = useLocaleKey();
  const me = useAdminMe();
  const sections = NAV_ITEMS.filter(
    (item) => item.permission !== null && can(me, item.permission),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-ink">{t("Home.welcome", { name: me.name })}</h1>
        {me.roleName && (
          <p className="text-base text-muted">{t("Home.role", { role: me.roleName[locale] })}</p>
        )}
      </header>
      {sections.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-ink">{t("Home.intro")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {sections.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex h-full flex-col gap-2 rounded-card bg-surface p-6 shadow-card transition-shadow hover:ring-2 hover:ring-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="text-xl font-semibold text-primary">{t(`nav.${item.label}`)}</span>
                  <span className="text-base text-muted">{t(`Home.${item.label}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
