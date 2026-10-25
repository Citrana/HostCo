import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminMe, answerQueries, LOCALES, renderAdmin } from "../test-utils";

const useQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useQuery }));
vi.mock("@/i18n/navigation", async () => (await import("../test-utils")).navigationMock);

const { RoleList } = await import("./role-list");

const roles = [
  { _id: "roles_sa", key: "superAdmin", name: { fr: "Super administrateur", en: "Super Admin" }, permissions: ["user.view"], isSystem: true },
  { _id: "roles_mod", key: "moderator", name: { fr: "Modérateur", en: "Moderator" }, permissions: ["property.publish", "property.view.any"], isSystem: false },
];

describe.each(LOCALES)("RoleList (%s)", (locale, messages) => {
  const t = messages.Admin;

  beforeEach(() => {
    useQuery.mockReset().mockImplementation(answerQueries({ "roles:list": roles }));
  });

  it("lists roles in the current language with their permission count", () => {
    renderAdmin(<RoleList />, { locale });

    const [, sa, mod] = screen.getAllByRole("row");
    expect(within(sa).getByRole("link", { name: roles[0].name[locale] })).toHaveAttribute(
      "href",
      "/admin/roles/roles_sa",
    );
    // The system role holds every permission, whatever is stored.
    expect(sa).toHaveTextContent(locale === "fr" ? "10 autorisations" : "10 permissions");
    expect(sa).toHaveTextContent(t.Roles.system);
    expect(mod).toHaveTextContent(locale === "fr" ? "2 autorisations" : "2 permissions");
    expect(mod).not.toHaveTextContent(t.Roles.system);
  });

  it("links to role creation", () => {
    renderAdmin(<RoleList />, { locale });

    expect(screen.getByRole("link", { name: t.Roles.new })).toHaveAttribute(
      "href",
      "/admin/roles/new",
    );
  });

  it("waits while the roles load", () => {
    useQuery.mockImplementation(answerQueries({}));
    renderAdmin(<RoleList />, { locale });

    expect(screen.getByText(t.loading)).toBeInTheDocument();
  });

  it("refuses a role without role.manage, without asking the server", () => {
    renderAdmin(<RoleList />, { locale, me: adminMe({ permissions: ["user.view"] }) });

    expect(screen.getByRole("heading", { name: t.noAccess.title })).toBeInTheDocument();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });
});
