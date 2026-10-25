"use client";

import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { useLocaleKey } from "@/lib/i18n/use-locale-key";
import { can, useAdminMe } from "../admin-session";
import { Badge, ButtonLink, Loading, NoAccess, PageHeader } from "../ui";

export type AdminUser = FunctionReturnType<typeof api.users.list>[number];

export function UserStatusBadges({ user }: { user: AdminUser }) {
  const t = useTranslations("Admin.Users.status");
  return (
    <span className="flex flex-wrap gap-2">
      {user.status === "active" ? (
        <Badge tone="green">{t("active")}</Badge>
      ) : (
        <Badge tone="amber">{t("disabled")}</Badge>
      )}
      {user.mustChangePassword && <Badge tone="primary">{t("pinPending")}</Badge>}
    </span>
  );
}

export function UserList() {
  const t = useTranslations("Admin");
  const locale = useLocaleKey();
  const me = useAdminMe();
  const allowed = can(me, "user.view");
  const users = useQuery(api.users.list, allowed ? {} : "skip");

  if (!allowed) return <NoAccess />;

  return (
    <>
      <PageHeader
        title={t("Users.title")}
        action={
          can(me, "user.manage") && <ButtonLink href="/admin/users/new">{t("Users.new")}</ButtonLink>
        }
      />
      {users === undefined ? (
        <Loading />
      ) : users.length === 0 ? (
        <p className="text-base text-muted">{t("Users.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-card">
          <table className="w-full min-w-xl text-left">
            <thead className="border-b border-border text-sm text-muted">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">{t("Users.columns.name")}</th>
                <th scope="col" className="px-6 py-4 font-medium">{t("Users.columns.role")}</th>
                <th scope="col" className="px-6 py-4 font-medium">{t("Users.columns.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user._id}>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/users/${user._id}`}
                      className="rounded-field text-base font-medium text-ink hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {user.name}
                    </Link>
                    <p className="text-sm text-muted">{user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-base text-ink">
                    {user.roleName?.[locale] ?? <span className="text-muted">{t("Users.noRole")}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <UserStatusBadges user={user} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
