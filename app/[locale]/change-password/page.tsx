import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.ChangePassword");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <ChangePasswordForm />;
}
