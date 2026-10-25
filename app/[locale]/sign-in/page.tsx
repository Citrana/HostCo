import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignInForm } from "@/components/auth/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.SignIn");
  return { title: t("metaTitle") };
}

export default function Page() {
  return <SignInForm />;
}
