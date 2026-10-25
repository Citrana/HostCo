import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALES, renderWithAuth } from "./test-utils";

const replace = vi.hoisted(() => vi.fn());
const changePassword = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("convex/react", () => ({ useMutation: () => changePassword }));

const { ChangePasswordForm } = await import("./change-password-form");

describe.each(LOCALES)("ChangePasswordForm (%s)", (locale, messages) => {
  const t = messages.Auth;

  beforeEach(() => {
    replace.mockReset();
    changePassword.mockReset().mockResolvedValue(null);
  });

  async function fill(current: string, next: string, confirm: string) {
    if (current) await userEvent.type(screen.getByLabelText(t.fields.currentPassword), current);
    if (next) await userEvent.type(screen.getByLabelText(t.fields.newPassword), next);
    if (confirm) await userEvent.type(screen.getByLabelText(t.fields.confirmPassword), confirm);
    await userEvent.click(screen.getByRole("button", { name: t.ChangePassword.submit }));
  }

  it("requires every field", async () => {
    renderWithAuth(<ChangePasswordForm />, { locale });

    await fill("", "", "");

    expect(screen.getAllByText(t.required)).toHaveLength(3);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("refuses a short new password", async () => {
    renderWithAuth(<ChangePasswordForm />, { locale });

    await fill("12345678", "short", "short");

    expect(screen.getByText(messages.Errors.PASSWORD_TOO_SHORT)).toBeInTheDocument();
  });

  it("refuses a confirmation that doesn't match", async () => {
    renderWithAuth(<ChangePasswordForm />, { locale });

    await fill("12345678", "a-brand-new-secret", "a-different-secret");

    expect(screen.getByText(t.ChangePassword.mismatch)).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("refuses to keep the PIN as the password", async () => {
    renderWithAuth(<ChangePasswordForm />, { locale });

    await fill("a-brand-new-secret", "a-brand-new-secret", "a-brand-new-secret");

    expect(screen.getByText(messages.Errors.PASSWORD_REUSED)).toBeInTheDocument();
  });

  it("saves the new password and opens the team area", async () => {
    renderWithAuth(<ChangePasswordForm />, { locale });

    await fill("12345678", "a-brand-new-secret", "a-brand-new-secret");

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "12345678",
      newPassword: "a-brand-new-secret",
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
  });

  it("shows the server's error in the current language", async () => {
    changePassword.mockRejectedValue(new ConvexError({ code: "INVALID_CREDENTIALS" }));
    renderWithAuth(<ChangePasswordForm />, { locale });

    await fill("87654321", "a-brand-new-secret", "a-brand-new-secret");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.Errors.INVALID_CREDENTIALS,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
