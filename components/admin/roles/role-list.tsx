"use client";

import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { PERMISSIONS } from "@/convex/lib/permissions";
import { Link } from "@/i18n/navigation";
import { useLocaleKey } from "@/lib/i18n/use-locale-key";
import { can, useAdminMe } from "../admin-session";
import { Badge, ButtonLink, Loading, NoAccess, PageHeader } from "../ui";

export function RoleList() {
  const t = useTranslations("Admin");
  const locale = useLocaleKey();
  const me = useAdminMe();
  const allowed = can(me, "role.manage");
  const roles = useQuery(api.roles.list, allowed ? {} : "skip");

  if (!allowed) return <NoAccess />;

  return (
    <>
      <PageHeader
        title={t("Roles.title")}
        action={<ButtonLink href="/admin/roles/new">{t("Roles.new")}</ButtonLink>}
      />
      {roles === undefined ? (
        <Loading />
      ) : (
        <div className="overflow-x-auto rounded-card bg-surface shadow-card">
          <table className="w-full min-w-md text-left">
            <thead className="border-b border-border text-sm text-muted">
              <tr>
                <th scope="col" className="px-6 py-4 font-medium">{t("Roles.columns.name")}</th>
                <th scope="col" className="px-6 py-4 font-medium">{t("Roles.columns.permissions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map((role) => (
                <tr key={role._id}>
                  <td className="px-6 py-4">
                    <span className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/roles/${role._id}`}
                        className="rounded-field text-base font-medium text-ink hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {role.name[locale]}
                      </Link>
                      {role.isSystem && <Badge tone="primary">{t("Roles.system")}</Badge>}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-base text-muted">
                    {t("Roles.permissionCount", {
                      count: role.isSystem ? PERMISSIONS.length : role.permissions.length,
                    })}
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
