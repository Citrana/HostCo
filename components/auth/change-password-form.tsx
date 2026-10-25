"use client";

import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { passwordProblem } from "@/convex/lib/password";
import { toErrorCode, type ClientErrorCode } from "@/lib/auth/errors";
import { useOpenPage } from "@/lib/navigation/open-page";
import { AuthCard, focusFirstInvalid, FormError, SubmitButton, TextField } from "./form-parts";

type FieldErrors = { current?: string; next?: string; confirm?: string };

export function ChangePasswordForm() {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const openPage = useOpenPage();
  const changePassword = useMutation(api.account.changePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const problem = passwordProblem(next);
    const errors: FieldErrors = {};
    if (current === "") errors.current = t("required");
    if (next === "") errors.next = t("required");
    else if (problem !== null) errors.next = tErrors(problem);
    else if (next === current) errors.next = tErrors("PASSWORD_REUSED");
    if (confirm === "") errors.confirm = t("required");
    else if (confirm !== next) errors.confirm = t("ChangePassword.mismatch");
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid([
        ["current-password", errors.current],
        ["new-password", errors.next],
        ["confirm-password", errors.confirm],
      ]);
      return;
    }

    setPending(true);
    let result;
    try {
      result = await changePassword({ currentPassword: current, newPassword: next });
    } catch (caught) {
      result = { ok: false, code: toErrorCode(caught) } as const;
    }
    if (result.ok) {
      openPage("/admin");
      return;
    }
    setError(result.code);
    setPending(false);
  }

  return (
    <AuthCard title={t("ChangePassword.title")} intro={t("ChangePassword.intro")}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <FormError message={error === null ? null : tErrors(error)} />
        <TextField
          id="current-password"
          type="password"
          label={t("fields.currentPassword")}
          value={current}
          onChange={setCurrent}
          error={fieldErrors.current}
          autoComplete="current-password"
        />
        <TextField
          id="new-password"
          type="password"
          label={t("fields.newPassword")}
          value={next}
          onChange={setNext}
          error={fieldErrors.next}
          hint={t("passwordHint")}
          autoComplete="new-password"
        />
        <TextField
          id="confirm-password"
          type="password"
          label={t("fields.confirmPassword")}
          value={confirm}
          onChange={setConfirm}
          error={fieldErrors.confirm}
          autoComplete="new-password"
        />
        <SubmitButton
          pending={pending}
          label={t("ChangePassword.submit")}
          pendingLabel={t("ChangePassword.submitting")}
        />
      </form>
    </AuthCard>
  );
}
