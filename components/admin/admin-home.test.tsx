import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { adminMe, LOCALES, renderAdmin } from "./test-utils";

vi.mock("@/i18n/navigation", async () => (await import("./test-utils")).navigationMock);

const { AdminHome } = await import("./admin-home");

describe.each(LOCALES)("AdminHome (%s)", (locale, messages) => {
  const t = messages.Admin;

  it("greets the user with their role in the current language", () => {
    const me = adminMe();
    renderAdmin(<AdminHome />, { locale, me });

    expect(
      screen.getByRole("heading", { level: 1, name: t.Home.welcome.replace("{name}", me.name) }),
    ).toBeInTheDocument();
    // Exact text: the French copy has a non-breaking space before the colon,
    // which the default matcher's whitespace normalizer would rewrite.
    const role = t.Home.role.replace("{role}", me.roleName![locale]);
    expect(screen.getByText((_, element) => element?.textContent === role)).toBeInTheDocument();
  });

  it("links to the sections the user's role allows", () => {
    renderAdmin(<AdminHome />, { locale, me: adminMe({ permissions: ["user.view"] }) });

    expect(screen.getByRole("link", { name: new RegExp(t.nav.users) })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(screen.queryByRole("link", { name: new RegExp(t.nav.roles) })).not.toBeInTheDocument();
  });

  it("shows no section links to a role without admin permissions", () => {
    renderAdmin(<AdminHome />, { locale, me: adminMe({ permissions: [], roleName: null }) });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
