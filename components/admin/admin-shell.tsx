"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Permission } from "@/convex/lib/permissions";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuthClient } from "@/lib/auth/client";
import { useOpenPage } from "@/lib/navigation/open-page";
import { FormError } from "../auth/form-parts";
import { AdminSessionContext, can, type AdminMe } from "./admin-session";
import { buttonStyles } from "./ui";

export const NAV_ITEMS: readonly {
  href: string;
  label: "home" | "users" | "roles";
  permission: Permission | null;
}[] = [
  { href: "/admin", label: "home", permission: null },
  { href: "/admin/users", label: "users", permission: "user.view" },
  { href: "/admin/roles", label: "roles", permission: "role.manage" },
];

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The frame of every admin page. Holds the pages back until the session is
 * known, sends away visitors who can't be here, and gives the pages the
 * signed-in user. Navigation only shows what the role allows; Convex enforces it.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("Admin");
  const auth = useAuthClient();
  const router = useRouter();
  const openPage = useOpenPage();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.account.me, isAuthenticated ? {} : "skip");

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

  if (me === undefined || me === null || mustChange) {
    return (
      <main className="flex flex-1 items-center justify-center bg-canvas px-4">
        <p className="text-sm text-muted">{t("loading")}</p>
      </main>
    );
  }

  return (
    <AdminSessionContext value={me}>
      <a
        href="#main-content"
        className="sr-only rounded-full bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20"
      >
        {t("skipToContent")}
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-field text-xl font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="flex size-10 items-center justify-center rounded-field bg-ink text-surface">
              <HouseIcon />
            </span>
            {t("brand")}
          </Link>
          <AdminNav me={me} />
          <AccountMenu me={me} />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </AdminSessionContext>
  );
}

function AdminNav({ me }: { me: AdminMe }) {
  const t = useTranslations("Admin.nav");
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.permission === null || can(me, item.permission));

  return (
    <nav aria-label={t("label")} className="order-last w-full sm:order-none sm:w-auto">
      <ul className="flex flex-wrap gap-1 rounded-full border border-border p-1">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`block rounded-full px-4 py-2 text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  current ? "bg-primary-soft font-medium text-primary" : "text-ink hover:bg-canvas"
                }`}
              >
                {t(item.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AccountMenu({ me }: { me: AdminMe }) {
  const t = useTranslations("Admin.accountMenu");
  const tErrors = useTranslations("Errors");
  const auth = useAuthClient();
  const openPage = useOpenPage();
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  // A menu left open shouldn't come back when Next shows this page again.
  useLayoutEffect(() => () => setOpen(false), []);

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

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

  return (
    <div
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) close();
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 text-left hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-base font-semibold text-primary"
        >
          {initials(me.name)}
        </span>
        <span className="text-base font-medium text-ink">{me.name}</span>
        <span className="sr-only">{t("label")}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 z-10 mt-2 flex w-72 flex-col gap-3 rounded-card bg-surface p-4 shadow-card"
        >
          <p className="break-all text-sm text-muted">{me.email}</p>
          <FormError message={signOutFailed ? tErrors("UNKNOWN") : null} />
          <button type="button" onClick={signOut} className={buttonStyles.secondary}>
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function HouseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
