import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminHome } from "@/components/admin/admin-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Home");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <AdminHome />;
}
