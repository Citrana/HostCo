import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoleForm } from "@/components/admin/roles/role-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.RoleForm");
  return { title: t("newMetaTitle") };
}

export default function Page() {
  return <RoleForm />;
}
