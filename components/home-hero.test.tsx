import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { HomeHero } from "./home-hero";

function renderIn(locale: "fr" | "en") {
  const messages = locale === "fr" ? fr : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HomeHero />
    </NextIntlClientProvider>,
  );
}

describe("HomeHero", () => {
  it("renders the French copy", () => {
    renderIn("fr");

    expect(
      screen.getByRole("heading", { level: 1, name: /pour commencer, modifiez le fichier page\.tsx/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "modèles" })).toHaveAttribute(
      "href",
      expect.stringContaining("vercel.com/templates"),
    );
  });

  it("renders the English copy", () => {
    renderIn("en");

    expect(
      screen.getByRole("heading", { level: 1, name: /to get started, edit the page\.tsx file/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learning" })).toHaveAttribute(
      "href",
      expect.stringContaining("nextjs.org/learn"),
    );
  });
});
