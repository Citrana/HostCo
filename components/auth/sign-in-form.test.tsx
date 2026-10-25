import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAuthClient, LOCALES, renderWithAuth } from "./test-utils";

const replace = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));

const { SignInForm } = await import("./sign-in-form");

describe.each(LOCALES)("SignInForm (%s)", (locale, messages) => {
  const t = messages.Auth;

  beforeEach(() => replace.mockReset());

  it("asks for both fields before calling the server", async () => {
    const auth = fakeAuthClient();
    renderWithAuth(<SignInForm />, { locale, auth });

    await userEvent.click(screen.getByRole("button", { name: t.SignIn.submit }));

    expect(screen.getAllByText(t.required)).toHaveLength(2);
    expect(screen.getByLabelText(t.fields.email)).toHaveAttribute("aria-invalid", "true");
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
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
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
  });
});
