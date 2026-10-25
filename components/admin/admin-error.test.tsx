import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { LOCALES, renderAdmin } from "./test-utils";

vi.mock("@/i18n/navigation", async () => (await import("./test-utils")).navigationMock);

const { AdminError } = await import("./admin-error");

describe.each(LOCALES)("AdminError (%s)", (locale, messages) => {
  const t = messages.Admin.Error;

  it("explains a Convex error code in the current language", () => {
    renderAdmin(<AdminError error={new ConvexError({ code: "FORBIDDEN" })} retry={vi.fn()} />, {
      locale,
    });

    expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();
    expect(screen.getByText(messages.Errors.FORBIDDEN)).toBeInTheDocument();
  });

  it("falls back to a generic message for anything else", () => {
    renderAdmin(<AdminError error={new Error("boom")} retry={vi.fn()} />, { locale });

    expect(screen.getByText(messages.Errors.UNKNOWN)).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("tries the page again", async () => {
    const retry = vi.fn();
    renderAdmin(<AdminError error={new Error("boom")} retry={retry} />, { locale });

    await userEvent.click(screen.getByRole("button", { name: t.retry }));

    expect(retry).toHaveBeenCalledOnce();
  });
});
