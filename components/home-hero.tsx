import { useTranslations } from "next-intl";

const linkClass = "font-medium text-zinc-950 dark:text-zinc-50";

export function HomeHero() {
  const t = useTranslations("HomePage");

  return (
    <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
      <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
        {t.rich("title", {
          code: (chunks) => (
            <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
              {chunks}
            </code>
          ),
        })}
      </h1>
      <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        {t.rich("intro", {
          templates: (chunks) => (
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className={linkClass}
            >
              {chunks}
            </a>
          ),
          learning: (chunks) => (
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className={linkClass}
            >
              {chunks}
            </a>
          ),
        })}
      </p>
    </div>
  );
}
