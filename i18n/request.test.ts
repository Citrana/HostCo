import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const rootLocale = vi.hoisted(() => vi.fn<() => Promise<string>>());

vi.mock("next/root-params", () => ({ locale: rootLocale }));
vi.mock("next-intl/server", () => ({
  getRequestConfig: <T>(create: T) => create,
}));

const { default: getConfig } = await import("./request");

type Params = Parameters<typeof getConfig>[0];
const params = (locale?: string) => ({ locale }) as Params;

describe("i18n request config", () => {
  beforeEach(() => {
    rootLocale.mockReset();
  });

  it("uses the locale from the URL segment", async () => {
    rootLocale.mockResolvedValue("en");

    await expect(getConfig(params())).resolves.toEqual({ locale: "en", messages: en });
  });

  it("prefers an explicitly requested locale over the URL segment", async () => {
    rootLocale.mockResolvedValue("en");

    await expect(getConfig(params("fr"))).resolves.toEqual({ locale: "fr", messages: fr });
  });

  it("falls back to French for an unsupported locale", async () => {
    rootLocale.mockResolvedValue("de");

    await expect(getConfig(params())).resolves.toEqual({ locale: "fr", messages: fr });
  });
});
