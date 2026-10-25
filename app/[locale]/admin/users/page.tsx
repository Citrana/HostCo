import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserList } from "@/components/admin/users/user-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.Users");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <UserList />;
}
