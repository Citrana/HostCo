import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, renderWithAuth } from "../auth/test-utils";
import { adminMe, LOCALES, navigation } from "./test-utils";

const openPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation/open-page", () => ({ useOpenPage: () => openPage }));
const useQuery = vi.hoisted(() => vi.fn());
const useConvexAuth = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useQuery, useConvexAuth }));
vi.mock("@/i18n/navigation", async () => (await import("./test-utils")).navigationMock);

const { AdminShell } = await import("./admin-shell");
const { useAdminMe } = await import("./admin-session");

function Child() {
  return <p>child of {useAdminMe().name}</p>;
}

describe.each(LOCALES)("AdminShell (%s)", (locale, messages) => {
  const t = messages.Admin;
  const me = adminMe();

  beforeEach(() => {
    navigation.pathname = "/admin";
    navigation.replace.mockReset();
    openPage.mockReset();
    useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
    useQuery.mockReturnValue(me);
  });

  function renderShell(auth = fakeAuthClient()) {
    return renderWithAuth(
      <AdminShell>
        <Child />
      </AdminShell>,
      { locale, auth },
    );
  }

  it("waits while the session loads", () => {
    useConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
    useQuery.mockReturnValue(undefined);
    renderShell();

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(screen.queryByText(/child of/)).not.toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in", async () => {
    useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
    useQuery.mockReturnValue(undefined);
    renderShell();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/sign-in"));
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("sends a user who still has a PIN to change it", async () => {
    useQuery.mockReturnValue({ ...me, mustChangePassword: true });
    renderShell();

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/change-password"));
    expect(screen.queryByText(/child of/)).not.toBeInTheDocument();
  });

  it("signs out a user whose account is no longer active", async () => {
    useQuery.mockReturnValue(null);
    const auth = fakeAuthClient();
    renderShell(auth);

    await waitFor(() => expect(openPage).toHaveBeenCalledWith("/sign-in"));
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("shows the page with the signed-in user", () => {
    renderShell();

    expect(screen.getByRole("main")).toHaveTextContent(`child of ${me.name}`);
  });

  it("only links to the sections the user's role allows", () => {
    useQuery.mockReturnValue(adminMe({ permissions: ["user.view"] }));
    renderShell();

    const nav = screen.getByRole("navigation", { name: t.nav.label });
    expect(within(nav).getByRole("link", { name: t.nav.home })).toHaveAttribute("href", "/admin");
    expect(within(nav).getByRole("link", { name: t.nav.users })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(within(nav).queryByRole("link", { name: t.nav.roles })).not.toBeInTheDocument();
  });

  it("hides users and roles from a role without those permissions", () => {
    useQuery.mockReturnValue(adminMe({ permissions: ["property.create"] }));
    renderShell();

    const nav = screen.getByRole("navigation", { name: t.nav.label });
    expect(within(nav).getAllByRole("link")).toHaveLength(1);
  });

  it("marks the current section, including its sub-pages", () => {
    navigation.pathname = "/admin/roles/abc";
    renderShell();

    const nav = screen.getByRole("navigation", { name: t.nav.label });
    expect(within(nav).getByRole("link", { name: t.nav.roles })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: t.nav.home })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("offers a skip link to the main content", () => {
    renderShell();

    expect(screen.getByRole("link", { name: t.skipToContent })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("opens the account menu and closes it with Escape", async () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: new RegExp(me.name) });

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(me.email)).toBeVisible();

    await userEvent.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: t.accountMenu.signOut })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("signs out from the account menu with a full page load", async () => {
    const auth = fakeAuthClient();
    renderShell(auth);

    await userEvent.click(screen.getByRole("button", { name: new RegExp(me.name) }));
    await userEvent.click(screen.getByRole("button", { name: t.accountMenu.signOut }));

    expect(auth.signOut).toHaveBeenCalledOnce();
    await waitFor(() => expect(openPage).toHaveBeenCalledWith("/sign-in"));
  });

  it("explains when signing out fails, and stays", async () => {
    const auth = fakeAuthClient({ signOut: vi.fn().mockRejectedValue(new TypeError("offline")) });
    renderShell(auth);

    await userEvent.click(screen.getByRole("button", { name: new RegExp(me.name) }));
    await userEvent.click(screen.getByRole("button", { name: t.accountMenu.signOut }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.Errors.UNKNOWN);
    expect(openPage).not.toHaveBeenCalled();
  });
});
