import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminMe, answerQueries, LOCALES, renderAdmin } from "../test-utils";

const useQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useQuery }));
vi.mock("@/i18n/navigation", async () => (await import("../test-utils")).navigationMock);

const { UserList } = await import("./user-list");

const users = [
  {
    _id: "users_1",
    _creationTime: 2,
    name: "Grace Mbuyi",
    email: "grace@example.com",
    roleId: "roles_1",
    roleName: { fr: "Modérateur", en: "Moderator" },
    status: "active",
    mustChangePassword: true,
    pinExpiresAt: 1_900_000_000_000,
  },
  {
    _id: "users_2",
    _creationTime: 1,
    name: "Joseph Ilunga",
    email: "joseph@example.com",
    roleId: "roles_gone",
    roleName: null,
    status: "disabled",
    mustChangePassword: false,
    pinExpiresAt: null,
  },
];

describe.each(LOCALES)("UserList (%s)", (locale, messages) => {
  const t = messages.Admin;

  beforeEach(() => {
    useQuery.mockReset().mockImplementation(answerQueries({ "users:list": users }));
  });

  it("lists users with their role and status in the current language", () => {
    renderAdmin(<UserList />, { locale });

    const [, grace, joseph] = screen.getAllByRole("row");
    expect(within(grace).getByRole("link", { name: "Grace Mbuyi" })).toHaveAttribute(
      "href",
      "/admin/users/users_1",
    );
    expect(grace).toHaveTextContent("grace@example.com");
    expect(grace).toHaveTextContent(users[0].roleName![locale]);
    expect(grace).toHaveTextContent(t.Users.status.active);
    expect(grace).toHaveTextContent(t.Users.status.pinPending);
    expect(joseph).toHaveTextContent(t.Users.status.disabled);
    expect(joseph).toHaveTextContent(t.Users.noRole);
  });

  it("offers to create a user only with user.manage", () => {
    const { unmount } = renderAdmin(<UserList />, { locale });
    expect(screen.getByRole("link", { name: t.Users.new })).toHaveAttribute(
      "href",
      "/admin/users/new",
    );
    unmount();

    renderAdmin(<UserList />, { locale, me: adminMe({ permissions: ["user.view"] }) });
    expect(screen.queryByRole("link", { name: t.Users.new })).not.toBeInTheDocument();
  });

  it("says so when there are no users", () => {
    useQuery.mockImplementation(answerQueries({ "users:list": [] }));
    renderAdmin(<UserList />, { locale });

    expect(screen.getByText(t.Users.empty)).toBeInTheDocument();
  });

  it("waits while the users load", () => {
    useQuery.mockImplementation(answerQueries({}));
    renderAdmin(<UserList />, { locale });

    expect(screen.getByText(t.loading)).toBeInTheDocument();
  });

  it("refuses a role without user.view, without asking the server", () => {
    renderAdmin(<UserList />, { locale, me: adminMe({ permissions: ["role.manage"] }) });

    expect(screen.getByRole("heading", { name: t.noAccess.title })).toBeInTheDocument();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });
});
