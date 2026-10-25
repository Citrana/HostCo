import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { RoleList } from "@/components/admin/roles/role-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Roles");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <RoleList />;
}
