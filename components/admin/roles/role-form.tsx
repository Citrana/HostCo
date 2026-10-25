"use client";

import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { PERMISSIONS, type Permission } from "@/convex/lib/permissions";
import { useRouter } from "@/i18n/navigation";
import { toErrorCode, type ClientErrorCode } from "@/lib/auth/errors";
import { useLocaleKey } from "@/lib/i18n/use-locale-key";
import { focusFirstInvalid, FormError, SubmitButton, TextField } from "../../auth/form-parts";
import { can, useAdminMe } from "../admin-session";
import {
  BackLink,
  buttonStyles,
  focusOnMount,
  Loading, NoAccess, PageHeader, Panel, StatusMessage } from "../ui";

const GROUPS = ["property", "user", "role", "location"] as const;

/** Creates a role (no `id`) or edits the role with that id. */
export function RoleForm({ id }: { id?: string }) {
  const t = useTranslations("Admin.RoleForm");
  const locale = useLocaleKey();
  const me = useAdminMe();
  const allowed = can(me, "role.manage");
  const role = useQuery(api.roles.get, allowed && id !== undefined ? { id } : "skip");

  if (!allowed) return <NoAccess />;

  const back = <BackLink href="/admin/roles" label={t("back")} />;
  if (id === undefined) {
    return (
      <>
        <PageHeader title={t("newTitle")} back={back} />
        <RoleEditor role={null} />
      </>
    );
  }
  if (role === undefined) return <Loading />;
  if (role === null) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-base text-ink">{t("notFound")}</p>
      </div>
    );
  }
  return (
    <>
      <PageHeader title={role.name[locale]} back={back} />
      {/* Keyed so the form restarts from the saved values for another role. */}
      <RoleEditor key={role._id} role={role} />
    </>
  );
}

function RoleEditor({ role }: { role: Doc<"roles"> | null }) {
  const t = useTranslations("Admin");
  const tAuth = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const router = useRouter();
  const me = useAdminMe();
  const createRole = useMutation(api.roles.create);
  const updateRole = useMutation(api.roles.update);
  const removeRole = useMutation(api.roles.remove);

  const [nameFr, setNameFr] = useState(role?.name.fr ?? "");
  const [nameEn, setNameEn] = useState(role?.name.en ?? "");
  const [permissions, setPermissions] = useState<Permission[]>(
    role === null ? [] : role.isSystem ? [...PERMISSIONS] : role.permissions,
  );
  const [fieldErrors, setFieldErrors] = useState<{ fr?: string; en?: string }>({});
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Set when the confirmation closes, so focus returns to the button.
  const refocusDelete = useRef(false);

  const locked = role?.isSystem === true;
  const ownRole = role !== null && role._id === me.roleId;
  // The server refuses to touch a role that grants more than the admin holds.
  const aboveLevel =
    role !== null && !locked && !role.permissions.every((permission) => can(me, permission));
  const readOnly = locked || ownRole || aboveLevel;
  const readOnlyReason = locked ? "locked" : ownRole ? "ownRole" : "aboveLevel";

  function toggle(permission: Permission, checked: boolean) {
    setPermissions((current) =>
      // Kept in the canonical order, whatever order they were ticked in.
      PERMISSIONS.filter((p) => (p === permission ? checked : current.includes(p))),
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || readOnly) return;
    const errors = {
      fr: nameFr.trim() === "" ? tAuth("required") : undefined,
      en: nameEn.trim() === "" ? tAuth("required") : undefined,
    };
    setFieldErrors(errors);
    setError(null);
    setSaved(false);
    if (errors.fr !== undefined || errors.en !== undefined) {
      focusFirstInvalid([
        ["name-fr", errors.fr],
        ["name-en", errors.en],
      ]);
      return;
    }

    const name = { fr: nameFr.trim(), en: nameEn.trim() };
    setPending(true);
    try {
      if (role === null) {
        await createRole({ name, permissions });
        // Next keeps this page alive, so it must be ready for the next role.
        setNameFr("");
        setNameEn("");
        setPermissions([]);
        setPending(false);
        router.replace("/admin/roles");
        return;
      }
      await updateRole({ id: role._id, name, permissions });
      setSaved(true);
    } catch (caught) {
      setError(toErrorCode(caught));
    }
    setPending(false);
  }

  async function onDelete() {
    if (role === null || pending) return;
    setError(null);
    setPending(true);
    try {
      await removeRole({ id: role._id });
      router.replace("/admin/roles");
    } catch (caught) {
      setError(toErrorCode(caught));
      refocusDelete.current = true;
    }
    setConfirmingDelete(false);
    setPending(false);
  }

  return (
    <Panel className="max-w-3xl">
      {readOnly && (
        <p className="mb-6 rounded-field bg-primary-soft px-4 py-3 text-base text-primary">
          {t(`RoleForm.${readOnlyReason}`)}
        </p>
      )}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        <FormError message={error === null ? null : tErrors(error)} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="name-fr"
            label={t("RoleForm.nameFr")}
            value={nameFr}
            onChange={setNameFr}
            error={fieldErrors.fr}
            hint={t("RoleForm.nameHint")}
            readOnly={readOnly}
            autoComplete="off"
          />
          <TextField
            id="name-en"
            label={t("RoleForm.nameEn")}
            value={nameEn}
            onChange={setNameEn}
            error={fieldErrors.en}
            hint={t("RoleForm.nameHint")}
            readOnly={readOnly}
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">{t("RoleForm.permissions")}</h2>
            {!readOnly && (
              <p className="mt-1 text-sm text-muted">{t("RoleForm.permissionsHint")}</p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {GROUPS.map((group) => (
              <fieldset key={group} className="flex flex-col gap-3 rounded-field border border-border p-4">
                <legend className="px-1 text-base font-medium text-ink">
                  {t(`PermissionGroups.${group}`)}
                </legend>
                {PERMISSIONS.filter((permission) => permission.startsWith(`${group}.`)).map(
                  (permission) => {
                    // Only what the admin holds can be granted (checked on the server too).
                    const disabled = readOnly || !can(me, permission);
                    return (
                      <label
                        key={permission}
                        className={`flex items-start gap-3 text-base ${disabled ? "text-muted" : "text-ink"}`}
                      >
                        <input
                          type="checkbox"
                          checked={permissions.includes(permission)}
                          disabled={disabled}
                          onChange={(event) => toggle(permission, event.target.checked)}
                          className="mt-0.5 size-5 shrink-0 accent-primary"
                        />
                        {t(`Permissions.${permission}`)}
                      </label>
                    );
                  },
                )}
              </fieldset>
            ))}
          </div>
        </div>

        {!readOnly && (
          <div className="flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <SubmitButton
              pending={pending}
              label={role === null ? t("RoleForm.create") : t("RoleForm.save")}
              pendingLabel={t("RoleForm.saving")}
            />
            {role !== null &&
              (confirmingDelete ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    aria-disabled={pending || undefined}
                    onClick={onDelete}
                    className={buttonStyles.primary}
                  >
                    {t("RoleForm.deleteConfirm")}
                  </button>
                  <button
                    ref={focusOnMount}
                    type="button"
                    onClick={() => {
                      refocusDelete.current = true;
                      setConfirmingDelete(false);
                    }}
                    className={buttonStyles.secondary}
                  >
                    {t("RoleForm.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  ref={(button) => {
                    if (button !== null && refocusDelete.current) {
                      refocusDelete.current = false;
                      button.focus();
                    }
                  }}
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className={buttonStyles.secondary}
                >
                  {t("RoleForm.delete")}
                </button>
              ))}
          </div>
        )}
        <StatusMessage message={saved ? t("RoleForm.saved") : null} />
      </form>
    </Panel>
  );
}
