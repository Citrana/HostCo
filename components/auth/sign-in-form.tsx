"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { isEmail, normalizeEmail } from "@/convex/lib/email";
import { useAuthClient } from "@/lib/auth/client";
import type { ClientErrorCode } from "@/lib/auth/errors";
import { useOpenPage } from "@/lib/navigation/open-page";
import { AuthCard, FormError, SubmitButton, TextField } from "./form-parts";

type FieldErrors = { email?: string; secret?: string };

export function SignInForm() {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const auth = useAuthClient();
  const openPage = useOpenPage();
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    const errors: FieldErrors = {};
    if (normalized === "") errors.email = t("required");
    else if (!isEmail(normalized)) errors.email = tErrors("EMAIL_INVALID");
    if (secret === "") errors.secret = t("required");
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    const result = await auth.signIn(normalized, secret);
    if (result.ok) {
      openPage("/admin");
      return;
    }
    setError(result.code);
    setPending(false);
  }

  return (
    <AuthCard title={t("SignIn.title")} intro={t("SignIn.intro")}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <FormError message={error === null ? null : tErrors(error)} />
        <TextField
          id="email"
          type="email"
          label={t("fields.email")}
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="username"
        />
        <TextField
          id="secret"
          type="password"
          label={t("fields.secret")}
          value={secret}
          onChange={setSecret}
          error={fieldErrors.secret}
          autoComplete="current-password"
        />
        <SubmitButton
          pending={pending}
          label={t("SignIn.submit")}
          pendingLabel={t("SignIn.submitting")}
        />
      </form>
    </AuthCard>
  );
}
