import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserCreateForm } from "@/components/admin/users/user-create-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.UserNew");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <UserCreateForm />;
}
