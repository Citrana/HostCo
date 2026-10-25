import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, LOCALES, renderWithAuth } from "../auth/test-utils";

const replace = vi.hoisted(() => vi.fn());
const openPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation/open-page", () => ({ useOpenPage: () => openPage }));
const useQuery = vi.hoisted(() => vi.fn());
const useConvexAuth = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("convex/react", () => ({ useQuery, useConvexAuth }));

const { AdminHome } = await import("./admin-home");

const me = {
  name: "Amani Kabila",
  email: "amani@example.com",
  roleName: { fr: "Super administrateur", en: "Super Admin" },
  mustChangePassword: false,
};

describe.each(LOCALES)("AdminHome (%s)", (locale, messages) => {
  const t = messages.Auth;

  beforeEach(() => {
    replace.mockReset();
    openPage.mockReset();
    useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true });
    useQuery.mockReturnValue(me);
  });

  it("waits while the session loads", () => {
    useConvexAuth.mockReturnValue({ isLoading: true, isAuthenticated: false });
    useQuery.mockReturnValue(undefined);
    renderWithAuth(<AdminHome />, { locale });

    expect(screen.getByText(t.loading)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign-in", async () => {
    useConvexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
    useQuery.mockReturnValue(undefined);
    renderWithAuth(<AdminHome />, { locale });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("sends a user who still has a PIN to change it", async () => {
    useQuery.mockReturnValue({ ...me, mustChangePassword: true });
    renderWithAuth(<AdminHome />, { locale });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/change-password"));
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("greets the user with their role in the current language", () => {
    renderWithAuth(<AdminHome />, { locale });

    expect(
      screen.getByRole("heading", { level: 1, name: t.Admin.welcome.replace("{name}", me.name) }),
    ).toBeInTheDocument();
    // Exact text: the French copy has a non-breaking space before the colon,
    // which the default matcher's whitespace normalizer would rewrite.
    const role = t.Admin.role.replace("{role}", me.roleName[locale]);
    expect(screen.getByText((_, element) => element?.textContent === role)).toBeInTheDocument();
  });

  it("signs out a user whose account is no longer active", async () => {
    useQuery.mockReturnValue(null);
    const auth = fakeAuthClient();
    renderWithAuth(<AdminHome />, { locale, auth });

    await waitFor(() => expect(openPage).toHaveBeenCalledWith("/sign-in"));
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("explains when signing out fails, and stays", async () => {
    const auth = fakeAuthClient({ signOut: vi.fn().mockRejectedValue(new TypeError("offline")) });
    renderWithAuth(<AdminHome />, { locale, auth });

    await userEvent.click(screen.getByRole("button", { name: t.Admin.signOut }));

    expect(await screen.findByText(messages.Errors.UNKNOWN)).toBeInTheDocument();
    expect(openPage).not.toHaveBeenCalled();
  });

  it("signs out and returns to the sign-in page", async () => {
    const auth = fakeAuthClient();
    renderWithAuth(<AdminHome />, { locale, auth });

    await userEvent.click(screen.getByRole("button", { name: t.Admin.signOut }));

    expect(auth.signOut).toHaveBeenCalledOnce();
    // A full page load clears every route Next keeps hidden for this user.
    await waitFor(() => expect(openPage).toHaveBeenCalledWith("/sign-in"));
  });
});
