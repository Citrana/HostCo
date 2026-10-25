"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { isEmail, normalizeEmail } from "@/convex/lib/email";
import { useRouter } from "@/i18n/navigation";
import { toErrorCode, type ClientErrorCode } from "@/lib/auth/errors";
import { useLocaleKey } from "@/lib/i18n/use-locale-key";
import {
  focusFirstInvalid,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../auth/form-parts";
import { can, canAssignRole, useAdminMe } from "../admin-session";
import { BackLink, Loading, NoAccess, PageHeader, Panel } from "../ui";
import { PinDialog, useOneTimePin } from "./pin-dialog";

type FieldErrors = { name?: string; email?: string; role?: string };

export function UserCreateForm() {
  const t = useTranslations("Admin");
  const tAuth = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const locale = useLocaleKey();
  const router = useRouter();
  const me = useAdminMe();
  const allowed = can(me, "user.manage");
  const roles = useQuery(api.roles.list, allowed ? {} : "skip");
  const createUser = useMutation(api.users.create);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useOneTimePin<{ id: Id<"users">; name: string; pin: string }>();

  if (!allowed) return <NoAccess />;

  const header = (
    <PageHeader
      title={t("UserNew.title")}
      back={<BackLink href="/admin/users" label={t("UserNew.back")} />}
    />
  );
  if (roles === undefined) {
    return (
      <>
        {header}
        <Loading />
      </>
    );
  }

  const assignable = roles.filter((role) => canAssignRole(me, role, roles));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const normalized = normalizeEmail(email);
    const errors: FieldErrors = {};
    if (name.trim() === "") errors.name = tAuth("required");
    if (normalized === "") errors.email = tAuth("required");
    else if (!isEmail(normalized)) errors.email = tErrors("EMAIL_INVALID");
    if (roleId === "") errors.role = tAuth("required");
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalid([
        ["name", errors.name],
        ["email", errors.email],
        ["role", errors.role],
      ]);
      return;
    }

    setPending(true);
    try {
      const result = await createUser({
        name: name.trim(),
        email: normalized,
        roleId: roleId as Id<"roles">,
      });
      setCreated({ ...result, name: name.trim() });
      // The form starts fresh if the admin comes back to it.
      setName("");
      setEmail("");
      setRoleId("");
    } catch (caught) {
      setError(toErrorCode(caught));
    }
    setPending(false);
  }

  return (
    <>
      {header}
      <Panel className="max-w-xl">
        <p className="mb-6 text-base text-muted">{t("UserNew.intro")}</p>
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <FormError message={error === null ? null : tErrors(error)} />
          <TextField
            id="name"
            label={t("UserForm.name")}
            value={name}
            onChange={setName}
            error={fieldErrors.name}
            autoComplete="off"
          />
          <TextField
            id="email"
            type="email"
            label={t("UserForm.email")}
            value={email}
            onChange={setEmail}
            error={fieldErrors.email}
            autoComplete="off"
          />
          <SelectField
            id="role"
            label={t("UserForm.role")}
            placeholder={t("UserForm.rolePlaceholder")}
            value={roleId}
            onChange={setRoleId}
            options={assignable.map((role) => ({ value: role._id, label: role.name[locale] }))}
            error={fieldErrors.role}
          />
          <SubmitButton
            pending={pending}
            label={t("UserNew.submit")}
            pendingLabel={t("UserNew.submitting")}
          />
        </form>
      </Panel>
      {created !== null && (
        <PinDialog
          pin={created.pin}
          name={created.name}
          onDone={() => {
            setCreated(null);
            router.replace(`/admin/users/${created.id}`);
          }}
        />
      )}
    </>
  );
}
