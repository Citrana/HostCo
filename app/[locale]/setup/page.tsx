import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SetupForm } from "@/components/auth/setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.Setup");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <SetupForm />;
}
