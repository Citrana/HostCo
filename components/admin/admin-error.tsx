"use client";

import { useTranslations } from "next-intl";
import { toErrorCode } from "@/lib/auth/errors";
import { buttonStyles, Panel } from "./ui";

/**
 * Shown inside the admin shell when a page fails, e.g. a query refused after
 * the user's role changed. Only translated codes are shown, never raw messages.
 */
export function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("Admin.Error");
  const tErrors = useTranslations("Errors");
  return (
    <Panel className="flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold text-ink">{t("title")}</h1>
      <p className="text-base text-muted">{tErrors(toErrorCode(error))}</p>
      <button type="button" onClick={retry} className={`${buttonStyles.secondary} self-start`}>
        {t("retry")}
      </button>
    </Panel>
  );
}
