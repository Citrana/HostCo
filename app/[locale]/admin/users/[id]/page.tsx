import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Loading } from "@/components/admin/ui";
import { UserDetail } from "@/components/admin/users/user-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.UserDetail");
  return { title: t("metaTitle") };
}

// With Cache Components, the id is only known at request time, so it is read
// inside a Suspense boundary.
export default function Page({ params }: PageProps<"/[locale]/admin/users/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      {params.then(({ id }) => (
        <UserDetail id={id} />
      ))}
    </Suspense>
  );
}
