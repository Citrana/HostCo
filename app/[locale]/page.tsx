import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { HomeHero } from "@/components/home-hero";

export default async function Home() {
  const t = await getTranslations("HomePage");

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-canvas">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-surface sm:items-start">
        <Image
          className="h-5 w-[100px]"
          src="/next.svg"
          alt={t("nextLogoAlt")}
          width={100}
          height={20}
          priority
        />
        <HomeHero />
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-on-primary transition-colors hover:bg-primary-hover md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="h-[14px] w-4"
              src="/vercel.svg"
              alt={t("vercelLogoAlt")}
              width={16}
              height={14}
            />
            {t("deploy")}
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-border px-5 text-primary transition-colors hover:border-transparent hover:bg-primary-soft md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("docs")}
          </a>
        </div>
      </main>
    </div>
  );
}
