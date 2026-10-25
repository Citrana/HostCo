"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export const buttonStyles = {
  primary: `inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 text-base font-medium text-on-primary transition-colors hover:bg-primary-hover aria-disabled:cursor-wait ${focusRing}`,
  secondary: `inline-flex h-12 items-center justify-center rounded-full bg-primary-soft px-6 text-base font-medium text-primary transition-colors hover:bg-border aria-disabled:cursor-wait ${focusRing}`,
};

export function ButtonLink({
  variant = "primary",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof buttonStyles }) {
  return <Link {...props} className={buttonStyles[variant]} />;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 rounded-full text-sm font-medium text-primary hover:underline ${focusRing}`}
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

export function PageHeader({
  title,
  back,
  action,
}: {
  title: string;
  back?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3">
      {back}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card bg-surface p-6 shadow-card ${className}`}>{children}</section>;
}

const badgeTones = {
  green: "bg-badge-green-soft text-badge-green",
  amber: "bg-badge-amber-soft text-badge-amber",
  primary: "bg-primary-soft text-primary",
};

export function Badge({ tone, children }: { tone: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function Loading() {
  const t = useTranslations("Admin");
  return <p className="text-sm text-muted">{t("loading")}</p>;
}

export function NoAccess() {
  const t = useTranslations("Admin.noAccess");
  return (
    <Panel>
      <h1 className="text-xl font-semibold text-ink">{t("title")}</h1>
      <p className="mt-2 text-base text-muted">{t("body")}</p>
    </Panel>
  );
}

/** A polite live region for "saved", "copied" and similar confirmations. */
export function StatusMessage({ message }: { message: string | null }) {
  return (
    <p role="status" className="text-sm font-medium text-badge-green">
      {message}
    </p>
  );
}
