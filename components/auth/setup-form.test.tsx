import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, LOCALES, renderWithAuth } from "./test-utils";

const replace = vi.hoisted(() => vi.fn());
const openPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation/open-page", () => ({ useOpenPage: () => openPage }));
const useQuery = vi.hoisted(() => vi.fn());
const bootstrap = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("convex/react", () => ({ useQuery, useMutation: () => bootstrap }));

const { SetupForm } = await import("./setup-form");

describe.each(LOCALES)("SetupForm (%s)", (locale, messages) => {
  const t = messages.Auth;

  beforeEach(() => {
    replace.mockReset();
    openPage.mockReset();
    bootstrap.mockReset().mockResolvedValue(null);
    useQuery.mockReturnValue({ needed: true });
  });

  async function fill(values: { name: string; email: string; password: string }) {
    await userEvent.type(screen.getByLabelText(t.fields.name), values.name);
    await userEvent.type(screen.getByLabelText(t.fields.email), values.email);
    await userEvent.type(screen.getByLabelText(t.fields.password), values.password);
    await userEvent.click(screen.getByRole("button", { name: t.Setup.submit }));
  }

  it("waits for the setup status", () => {
    useQuery.mockReturnValue(undefined);
    renderWithAuth(<SetupForm />, { locale });

    expect(screen.getByText(t.loading)).toBeInTheDocument();
  });

  it("sends visitors to sign-in once setup is done", async () => {
    useQuery.mockReturnValue({ needed: false });
    renderWithAuth(<SetupForm />, { locale });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("checks the fields before calling the server", async () => {
    renderWithAuth(<SetupForm />, { locale });

    await fill({ name: " ", email: "nope", password: "short" });

    expect(screen.getByText(t.required)).toBeInTheDocument();
    expect(screen.getByText(messages.Errors.EMAIL_INVALID)).toBeInTheDocument();
    expect(screen.getByText(messages.Errors.PASSWORD_TOO_SHORT)).toBeInTheDocument();
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it("creates the admin, signs them in and opens the team area", async () => {
    const auth = fakeAuthClient();
    renderWithAuth(<SetupForm />, { locale, auth });

    await fill({ name: "Amani", email: "Amani@Example.com", password: "a-long-secret-1" });

    expect(bootstrap).toHaveBeenCalledWith({
      name: "Amani",
      email: "amani@example.com",
      password: "a-long-secret-1",
    });
    // A full page load, so the auth provider starts from the new session.
    await waitFor(() => expect(openPage).toHaveBeenCalledWith("/admin"));
    expect(replace).not.toHaveBeenCalled();
    expect(auth.signIn).toHaveBeenCalledWith("amani@example.com", "a-long-secret-1");
  });

  it("falls back to the sign-in page if the automatic sign-in fails", async () => {
    const auth = fakeAuthClient({
      signIn: vi.fn().mockResolvedValue({ ok: false, code: "UNKNOWN" }),
    });
    renderWithAuth(<SetupForm />, { locale, auth });

    await fill({ name: "Amani", email: "amani@example.com", password: "a-long-secret-1" });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/sign-in"));
  });

  it("shows the server's error in the current language", async () => {
    bootstrap.mockRejectedValue(new ConvexError({ code: "SETUP_ALREADY_DONE" }));
    renderWithAuth(<SetupForm />, { locale });

    await fill({ name: "Amani", email: "amani@example.com", password: "a-long-secret-1" });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.Errors.SETUP_ALREADY_DONE,
    );
  });
});
