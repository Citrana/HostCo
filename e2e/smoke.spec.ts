import { expect, test } from "@playwright/test";

// `/` redirects using the browser's Accept-Language, falling back to French.
const redirects = [
  { browserLocale: "fr-FR", expected: "fr" },
  { browserLocale: "en-US", expected: "en" },
  { browserLocale: "de-DE", expected: "fr" },
];

for (const { browserLocale, expected } of redirects) {
  test.describe(`browser language ${browserLocale}`, () => {
    test.use({ locale: browserLocale });

    test(`redirects / to /${expected}`, async ({ page }) => {
      await page.goto("/");

      await expect(page).toHaveURL(new RegExp(`/${expected}$`));
    });
  });
}

const locales = [
  { locale: "fr", heading: /pour commencer, modifiez le fichier page\.tsx/i, title: "hostco" },
  { locale: "en", heading: /to get started, edit the page\.tsx file/i, title: "hostco" },
];

for (const { locale, heading, title } of locales) {
  test(`renders the home page in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  });
}
