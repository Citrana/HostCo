"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import { isEmail, normalizeEmail } from "@/convex/lib/email";
import { passwordProblem } from "@/convex/lib/password";
import { useRouter } from "@/i18n/navigation";
import { useAuthClient } from "@/lib/auth/client";
import { toErrorCode, type ClientErrorCode } from "@/lib/auth/errors";
import { AuthCard, FormError, SubmitButton, TextField } from "./form-parts";

type FieldErrors = { name?: string; email?: string; password?: string };

export function SetupForm() {
  const t = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const auth = useAuthClient();
  const router = useRouter();
  const status = useQuery(api.setup.status, {});
  const bootstrap = useMutation(api.setup.bootstrapSuperAdmin);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [pending, setPending] = useState(false);

  const done = status !== undefined && !status.needed;
  useEffect(() => {
    // After our own submit we navigate ourselves; this is for later visits.
    if (done && !pending) router.replace("/sign-in");
  }, [done, pending, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalized = normalizeEmail(email);
    const problem = passwordProblem(password);
    const errors: FieldErrors = {};
    if (trimmedName === "") errors.name = t("required");
    if (normalized === "") errors.email = t("required");
    else if (!isEmail(normalized)) errors.email = tErrors("EMAIL_INVALID");
    if (password === "") errors.password = t("required");
    else if (problem !== null) errors.password = tErrors(problem);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await bootstrap({ name: trimmedName, email: normalized, password });
    } catch (caught) {
      setError(toErrorCode(caught));
      setPending(false);
      return;
    }
    const signedIn = await auth.signIn(normalized, password);
    router.replace(signedIn.ok ? "/admin" : "/sign-in");
  }

  const card = (body: React.ReactNode) => (
    <AuthCard title={t("Setup.title")} intro={t("Setup.intro")}>
      {body}
    </AuthCard>
  );

  if (status === undefined || (done && !pending)) {
    return card(<p className="text-sm text-muted">{t("loading")}</p>);
  }

  return card(
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError message={error === null ? null : tErrors(error)} />
      <TextField
        id="name"
        label={t("fields.name")}
        value={name}
        onChange={setName}
        error={fieldErrors.name}
        autoComplete="name"
      />
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
        id="password"
        type="password"
        label={t("fields.password")}
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
        hint={t("passwordHint")}
        autoComplete="new-password"
      />
      <SubmitButton pending={pending} label={t("Setup.submit")} pendingLabel={t("Setup.submitting")} />
    </form>,
  );
}
