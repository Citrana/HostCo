"use client";

import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Link } from "@/i18n/navigation";
import { toErrorCode, type ClientErrorCode } from "@/lib/auth/errors";
import { useLocaleKey } from "@/lib/i18n/use-locale-key";
import {
  focusFirstInvalid,
  FormError,
  SelectField,
  SubmitButton,
  TextField,
} from "../../auth/form-parts";
import { can, canAssignRole, useAdminMe, type AdminMe } from "../admin-session";
import {
  BackLink,
  buttonStyles,
  focusOnMount,
  Loading, NoAccess, PageHeader, Panel, StatusMessage } from "../ui";
import { PinDialog, useOneTimePin } from "./pin-dialog";
import { UserStatusBadges } from "./user-list";

type AdminUser = NonNullable<FunctionReturnType<typeof api.users.get>>;

export function UserDetail({ id }: { id: string }) {
  const t = useTranslations("Admin");
  const me = useAdminMe();
  const allowed = can(me, "user.view");
  const user = useQuery(api.users.get, allowed ? { id } : "skip");
  const roles = useQuery(api.roles.list, allowed ? {} : "skip");

  if (!allowed) return <NoAccess />;

  const back = <BackLink href="/admin/users" label={t("UserDetail.back")} />;
  if (user === undefined || roles === undefined) return <Loading />;
  if (user === null) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-base text-ink">{t("UserDetail.notFound")}</p>
      </div>
    );
  }

  const role = roles.find((r) => r._id === user.roleId);
  // Mirrors the server: only users whose role the admin could grant.
  const manageable = can(me, "user.manage") && (role === undefined || canAssignRole(me, role, roles));
  const isSelf = user._id === me.id;

  return (
    <>
      <PageHeader title={user.name} back={back} action={<UserStatusBadges user={user} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        {manageable ? (
          // Keyed so the form restarts from the saved values for another user.
          <ProfileForm key={user._id} user={user} roles={roles} me={me} />
        ) : (
          <ProfileSummary user={user} />
        )}
        {isSelf ? (
          <Panel>
            <p className="text-base text-ink">{t("UserDetail.self")}</p>
            <Link
              href="/change-password"
              className="mt-4 inline-flex text-base font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t("UserDetail.changeOwnPassword")}
            </Link>
          </Panel>
        ) : (
          manageable && <AccessPanel user={user} />
        )}
      </div>
    </>
  );
}

function ProfileSummary({ user }: { user: AdminUser }) {
  const t = useTranslations("Admin");
  const locale = useLocaleKey();
  return (
    <Panel>
      <h2 className="text-xl font-semibold text-ink">{t("UserDetail.profile")}</h2>
      <dl className="mt-4 grid gap-4">
        <div>
          <dt className="text-sm text-muted">{t("UserForm.email")}</dt>
          <dd className="text-base text-ink">{user.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t("UserForm.role")}</dt>
          <dd className="text-base text-ink">{user.roleName?.[locale] ?? t("Users.noRole")}</dd>
        </div>
      </dl>
    </Panel>
  );
}

function ProfileForm({
  user,
  roles,
  me,
}: {
  user: AdminUser;
  roles: Doc<"roles">[];
  me: AdminMe;
}) {
  const t = useTranslations("Admin");
  const tAuth = useTranslations("Auth");
  const tErrors = useTranslations("Errors");
  const locale = useLocaleKey();
  const updateUser = useMutation(api.users.update);
  const [name, setName] = useState(user.name);
  // The role the form opened with: only a role the admin picked is sent.
  const [initialRoleId] = useState<string>(user.roleId);
  const [roleId, setRoleId] = useState<string>(user.roleId);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; role?: string }>({});
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  // The current role stays listed even when the admin couldn't grant it.
  const options = roles.filter((role) => role._id === user.roleId || canAssignRole(me, role, roles));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const role = roles.find((r) => r._id === roleId);
    const errors = {
      name: name.trim() === "" ? tAuth("required") : undefined,
      role: role === undefined ? tAuth("required") : undefined,
    };
    setFieldErrors(errors);
    setError(null);
    setSaved(false);
    if (errors.name !== undefined || role === undefined) {
      focusFirstInvalid([
        ["name", errors.name],
        ["role", errors.role],
      ]);
      return;
    }
    setPending(true);
    try {
      await updateUser({
        id: user._id,
        name: name.trim(),
        ...(roleId === initialRoleId ? {} : { roleId: role._id }),
      });
      setSaved(true);
    } catch (caught) {
      setError(toErrorCode(caught));
    }
    setPending(false);
  }

  return (
    <Panel>
      <h2 className="text-xl font-semibold text-ink">{t("UserDetail.profile")}</h2>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      <form noValidate onSubmit={onSubmit} className="mt-6 flex flex-col gap-5">
        <FormError message={error === null ? null : tErrors(error)} />
        <TextField
          id="name"
          label={t("UserForm.name")}
          value={name}
          onChange={setName}
          error={fieldErrors.name}
          autoComplete="off"
        />
        <SelectField
          id="role"
          label={t("UserForm.role")}
          placeholder={t("UserForm.rolePlaceholder")}
          value={roleId}
          onChange={setRoleId}
          options={options.map((role) => ({ value: role._id, label: role.name[locale] }))}
          error={fieldErrors.role}
        />
        <StatusMessage message={saved ? t("UserDetail.saved") : null} />
        <SubmitButton
          pending={pending}
          label={t("UserDetail.save")}
          pendingLabel={t("UserDetail.saving")}
        />
      </form>
    </Panel>
  );
}

function AccessPanel({ user }: { user: AdminUser }) {
  const t = useTranslations("Admin.UserDetail");
  const tErrors = useTranslations("Errors");
  const format = useFormatter();
  const setStatus = useMutation(api.users.setStatus);
  const resetPin = useMutation(api.users.resetPin);
  // Set when the confirmation closes, so focus returns to the button.
  const refocusReset = useRef(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const [issued, setIssued] = useOneTimePin<{ pin: string }>();

  async function run(action: () => Promise<unknown>) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (caught) {
      setError(toErrorCode(caught));
    }
    setPending(false);
  }

  const active = user.status === "active";

  return (
    <Panel className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold text-ink">{t("access")}</h2>
      <FormError message={error === null ? null : tErrors(error)} />
      {user.mustChangePassword && user.pinExpiresAt !== null && (
        <p className="text-base text-ink">
          {t("pinExpires", {
            date: format.dateTime(user.pinExpiresAt, { dateStyle: "long", timeStyle: "short" }),
          })}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          aria-disabled={pending || undefined}
          onClick={() => run(() => setStatus({ id: user._id, status: active ? "disabled" : "active" }))}
          className={`${buttonStyles.secondary} self-start`}
        >
          {active ? t("disable") : t("enable")}
        </button>
        {active && <p className="text-sm text-muted">{t("disableHint")}</p>}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        {confirmingReset ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              aria-disabled={pending || undefined}
              onClick={() =>
                run(async () => {
                  setIssued(await resetPin({ id: user._id }));
                  // Focus goes back to "Generate" first, so the PIN dialog
                  // returns it there when it closes.
                  refocusReset.current = true;
                  setConfirmingReset(false);
                })
              }
              className={buttonStyles.primary}
            >
              {pending ? t("working") : t("resetPinConfirm")}
            </button>
            <button
              ref={focusOnMount}
              type="button"
              onClick={() => {
                refocusReset.current = true;
                setConfirmingReset(false);
              }}
              className={buttonStyles.secondary}
            >
              {t("cancel")}
            </button>
          </div>
        ) : (
          <button
            ref={(button) => {
              if (button !== null && refocusReset.current) {
                refocusReset.current = false;
                button.focus();
              }
            }}
            type="button"
            onClick={() => setConfirmingReset(true)}
            className={`${buttonStyles.secondary} self-start`}
          >
            {t("resetPin")}
          </button>
        )}
        <p className="text-sm text-muted">{t("resetPinHint")}</p>
      </div>

      {issued !== null && (
        <PinDialog pin={issued.pin} name={user.name} onDone={() => setIssued(null)} />
      )}
    </Panel>
  );
}
