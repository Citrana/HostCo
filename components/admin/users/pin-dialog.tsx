"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { buttonStyles, StatusMessage } from "../ui";

/**
 * Holds a freshly issued PIN, the only copy the browser ever gets. It is
 * forgotten when the admin closes the dialog, and also when Next hides the
 * page (Cache Components keeps visited pages alive), so it can't resurface.
 */
export function useOneTimePin<T extends { pin: string }>() {
  const [issued, setIssued] = useState<T | null>(null);
  const visible = useRef(true);
  useLayoutEffect(() => {
    visible.current = true;
    return () => {
      visible.current = false;
      setIssued(null);
    };
  }, []);
  // A PIN that arrives while the page is hidden is dropped too; the admin can
  // issue a new one, which is safer than showing a stale one later.
  const keep = useCallback((value: T | null) => {
    if (value === null || visible.current) setIssued(value);
  }, []);
  return [issued, keep] as const;
}

/**
 * Shows a one-time PIN until the admin confirms they passed it on. An
 * `alertdialog` because it needs that confirmation: Escape doesn't dismiss it.
 */
export function PinDialog({ pin, name, onDone }: { pin: string; name: string; onDone: () => void }) {
  const t = useTranslations("Admin.Pin");
  const titleId = useId();
  const introId = useId();
  const pinId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "copyFailed" | null>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    copyRef.current?.focus();
    return () => opener?.focus();
  }, []);

  function trapFocus(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const buttons = dialogRef.current?.querySelectorAll("button");
    if (!buttons || buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(pin);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("copyFailed");
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 px-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={`${introId} ${pinId}`}
        onKeyDown={trapFocus}
        className="flex w-full max-w-md flex-col gap-5 rounded-card bg-surface p-8 shadow-card"
      >
        <h2 id={titleId} className="text-xl font-semibold text-ink">
          {t("title")}
        </h2>
        <p id={introId} className="text-base text-muted">
          {t("intro", { name })}
        </p>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">{t("label")}</span>
          <p id={pinId} className="rounded-field bg-canvas px-4 py-3 text-center font-mono text-3xl font-semibold tracking-widest text-ink">
            {pin}
          </p>
        </div>
        <StatusMessage message={copyStatus === null ? null : t(copyStatus)} />
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button ref={copyRef} type="button" onClick={copy} className={buttonStyles.primary}>
            {t("copy")}
          </button>
          <button type="button" onClick={onDone} className={buttonStyles.secondary}>
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
}
