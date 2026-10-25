import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALES, renderAdmin } from "../test-utils";
import { PinDialog } from "./pin-dialog";

describe.each(LOCALES)("PinDialog (%s)", (locale, messages) => {
  const t = messages.Admin.Pin;

  afterEach(() => vi.restoreAllMocks());

  function renderDialog(onDone = vi.fn()) {
    renderAdmin(<PinDialog pin="40719263" name="Grace Mbuyi" onDone={onDone} />, { locale });
    return { onDone };
  }

  it("shows the PIN in a modal dialog that names the user", () => {
    renderDialog();

    const dialog = screen.getByRole("alertdialog", { name: t.title });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveTextContent("40719263");
    expect(dialog).toHaveTextContent(t.intro.replace("{name}", "Grace Mbuyi"));
  });

  it("moves focus into the dialog and keeps it there", async () => {
    renderDialog();
    const copy = screen.getByRole("button", { name: t.copy });
    const done = screen.getByRole("button", { name: t.done });

    expect(copy).toHaveFocus();
    await userEvent.tab();
    expect(done).toHaveFocus();
    await userEvent.tab();
    expect(copy).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(done).toHaveFocus();
  });

  it("copies the PIN to the clipboard and says so", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: t.copy }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(t.copied));
    await expect(navigator.clipboard.readText()).resolves.toBe("40719263");
  });

  it("asks to write the PIN down when copying fails", async () => {
    const user = userEvent.setup();
    renderDialog();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));

    await user.click(screen.getByRole("button", { name: t.copy }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(t.copyFailed));
  });

  it("hands back control once the PIN is passed on", async () => {
    const { onDone } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: t.done }));

    expect(onDone).toHaveBeenCalledOnce();
  });
});
