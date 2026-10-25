import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RoleForm } from "@/components/admin/roles/role-form";
import { Loading } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.RoleForm");
  return { title: t("editMetaTitle") };
}

// With Cache Components, the id is only known at request time, so it is read
// inside a Suspense boundary.
export default function Page({ params }: PageProps<"/[locale]/admin/roles/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ id }) => (
        <RoleForm id={id} />
      ))}
    </Suspense>
  );
}
