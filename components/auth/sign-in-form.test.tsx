import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, LOCALES, renderWithAuth } from "./test-utils";

const replace = vi.hoisted(() => vi.fn());
const openPage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/navigation/open-page", () => ({ useOpenPage: () => openPage }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));

const { SignInForm } = await import("./sign-in-form");

describe.each(LOCALES)("SignInForm (%s)", (locale, messages) => {
  const t = messages.Auth;

  beforeEach(() => {
    replace.mockReset();
    openPage.mockReset();
  });

  it("asks for both fields before calling the server", async () => {
    const auth = fakeAuthClient();
    renderWithAuth(<SignInForm />, { locale, auth });

    await userEvent.click(screen.getByRole("button", { name: t.SignIn.submit }));

    expect(screen.getAllByText(t.required)).toHaveLength(2);
    expect(screen.getByLabelText(t.fields.email)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(t.fields.email)).toHaveFocus();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("rejects an email that isn't one", async () => {
    renderWithAuth(<SignInForm />, { locale });

    await userEvent.type(screen.getByLabelText(t.fields.email), "nope");
    await userEvent.type(screen.getByLabelText(t.fields.secret), "12345678");
    await userEvent.click(screen.getByRole("button", { name: t.SignIn.submit }));

    expect(screen.getByText(messages.Errors.EMAIL_INVALID)).toBeInTheDocument();
  });

  it("signs in and goes to the team area", async () => {
    const auth = fakeAuthClient();
    renderWithAuth(<SignInForm />, { locale, auth });

    await userEvent.type(screen.getByLabelText(t.fields.email), " Amani@Example.com ");
    await userEvent.type(screen.getByLabelText(t.fields.secret), "12345678");
    await userEvent.click(screen.getByRole("button", { name: t.SignIn.submit }));

    expect(auth.signIn).toHaveBeenCalledWith("amani@example.com", "12345678");
    // A full page load, so the auth provider starts from the new session.
    await waitFor(() => expect(openPage).toHaveBeenCalledWith("/admin"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the button focusable and ignores repeat submits while signing in", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    const auth = fakeAuthClient({
      signIn: vi.fn(() => new Promise<{ ok: true }>((resolve) => (finish = resolve))),
    });
    renderWithAuth(<SignInForm />, { locale, auth });
    await userEvent.type(screen.getByLabelText(t.fields.email), "amani@example.com");
    await userEvent.type(screen.getByLabelText(t.fields.secret), "12345678");
    const button = screen.getByRole("button", { name: t.SignIn.submit });

    await userEvent.click(button);
    await userEvent.click(button);

    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveFocus();
    expect(auth.signIn).toHaveBeenCalledOnce();
    finish({ ok: true });
  });

  it("shows the server's error in the current language", async () => {
    const auth = fakeAuthClient({
      signIn: vi.fn().mockResolvedValue({ ok: false, code: "PIN_EXPIRED" }),
    });
    renderWithAuth(<SignInForm />, { locale, auth });

    await userEvent.type(screen.getByLabelText(t.fields.email), "amani@example.com");
    await userEvent.type(screen.getByLabelText(t.fields.secret), "12345678");
    await userEvent.click(screen.getByRole("button", { name: t.SignIn.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.Errors.PIN_EXPIRED);
    expect(replace).not.toHaveBeenCalled();
    expect(openPage).not.toHaveBeenCalled();
  });
});
