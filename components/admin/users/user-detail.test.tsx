import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminMe, answerQueries, LOCALES, mutations, renderAdmin } from "../test-utils";

const useQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () => ({
  useQuery,
  useMutation: (await import("../test-utils")).mutations.useMutation,
}));
vi.mock("@/i18n/navigation", async () => (await import("../test-utils")).navigationMock);

const { UserDetail } = await import("./user-detail");

const roles = [
  { _id: "roles_me", key: "superAdmin", name: { fr: "Super administrateur", en: "Super Admin" }, permissions: [], isSystem: true },
  { _id: "roles_mod", key: "moderator", name: { fr: "Modérateur", en: "Moderator" }, permissions: ["property.publish"], isSystem: false },
  { _id: "roles_support", key: "supportAgent", name: { fr: "Agent d’assistance", en: "Support Agent" }, permissions: ["user.view"], isSystem: false },
];

const grace = {
  _id: "users_grace",
  _creationTime: 1,
  name: "Grace Mbuyi",
  email: "grace@example.com",
  roleId: "roles_mod",
  roleName: roles[1].name,
  status: "active",
  mustChangePassword: false,
  pinExpiresAt: null,
};

describe.each(LOCALES)("UserDetail (%s)", (locale, messages) => {
  const t = messages.Admin;

  beforeEach(() => {
    mutations.reset();
    mutations.get("users:update").mockResolvedValue(null);
    mutations.get("users:setStatus").mockResolvedValue(null);
    mutations.get("users:resetPin").mockResolvedValue({ pin: "55501234" });
    useQuery.mockReset().mockImplementation(answerQueries({ "users:get": grace, "roles:list": roles }));
  });

  function renderDetail(me = adminMe()) {
    return renderAdmin(<UserDetail id="users_grace" />, { locale, me });
  }

  it("says so when the user doesn't exist", () => {
    useQuery.mockImplementation(answerQueries({ "users:get": null, "roles:list": roles }));
    renderDetail();

    expect(screen.getByText(t.UserDetail.notFound)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.UserDetail.back })).toHaveAttribute(
      "href",
      "/admin/users",
    );
  });

  it("waits while the user loads", () => {
    useQuery.mockImplementation(answerQueries({ "roles:list": roles }));
    renderDetail();

    expect(screen.getByText(t.loading)).toBeInTheDocument();
  });

  it("refuses a role without user.view, without asking the server", () => {
    renderDetail(adminMe({ permissions: ["role.manage"] }));

    expect(screen.getByRole("heading", { name: t.noAccess.title })).toBeInTheDocument();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("is read-only for a role with user.view only", () => {
    renderDetail(adminMe({ permissions: ["user.view"] }));

    expect(screen.getByRole("heading", { level: 1, name: grace.name })).toBeInTheDocument();
    expect(screen.getByText(grace.email)).toBeInTheDocument();
    expect(screen.getByText(roles[1].name[locale])).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is read-only when the user's role is beyond the admin's own", () => {
    const me = adminMe({ roleId: "roles_other" as never, permissions: ["user.view", "user.manage"] });
    renderDetail(me);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("saves a new name and role", async () => {
    renderDetail();

    const name = screen.getByLabelText(t.UserForm.name);
    await userEvent.clear(name);
    await userEvent.type(name, "Grace M.");
    await userEvent.selectOptions(screen.getByLabelText(t.UserForm.role), roles[2].name[locale]);
    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.save }));

    expect(mutations.get("users:update")).toHaveBeenCalledWith({
      id: "users_grace",
      name: "Grace M.",
      roleId: "roles_support",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(t.UserDetail.saved);
  });

  it("requires a name", async () => {
    renderDetail();

    await userEvent.clear(screen.getByLabelText(t.UserForm.name));
    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.save }));

    expect(screen.getByText(messages.Auth.required)).toBeInTheDocument();
    expect(mutations.get("users:update")).not.toHaveBeenCalled();
  });

  it("disables an active account", async () => {
    renderDetail();

    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.disable }));

    expect(mutations.get("users:setStatus")).toHaveBeenCalledWith({
      id: "users_grace",
      status: "disabled",
    });
  });

  it("enables a disabled account", async () => {
    useQuery.mockImplementation(
      answerQueries({ "users:get": { ...grace, status: "disabled" }, "roles:list": roles }),
    );
    renderDetail();

    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.enable }));

    expect(mutations.get("users:setStatus")).toHaveBeenCalledWith({
      id: "users_grace",
      status: "active",
    });
  });

  it("explains in the current language why an action failed", async () => {
    mutations.get("users:setStatus").mockRejectedValue(new ConvexError({ code: "LAST_SUPER_ADMIN" }));
    renderDetail();

    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.disable }));

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.Errors.LAST_SUPER_ADMIN);
  });

  it("generates a new PIN after confirmation and shows it once", async () => {
    renderDetail();

    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.resetPin }));
    expect(mutations.get("users:resetPin")).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.resetPinConfirm }));

    expect(mutations.get("users:resetPin")).toHaveBeenCalledWith({ id: "users_grace" });
    const dialog = await screen.findByRole("alertdialog", { name: t.Pin.title });
    expect(dialog).toHaveTextContent("55501234");
    await userEvent.click(within(dialog).getByRole("button", { name: t.Pin.done }));
    expect(screen.queryByText("55501234")).not.toBeInTheDocument();
  });

  it("can cancel generating a new PIN", async () => {
    renderDetail();

    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.resetPin }));
    await userEvent.click(screen.getByRole("button", { name: t.UserDetail.cancel }));

    expect(screen.getByRole("button", { name: t.UserDetail.resetPin })).toHaveFocus();
    expect(mutations.get("users:resetPin")).not.toHaveBeenCalled();
  });

  it("shows until when a pending PIN is valid, formatted for the locale", () => {
    const pinExpiresAt = Date.UTC(2026, 10, 3, 12, 0);
    useQuery.mockImplementation(
      answerQueries({
        "users:get": { ...grace, mustChangePassword: true, pinExpiresAt },
        "roles:list": roles,
      }),
    );
    renderDetail();

    const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(
      pinExpiresAt,
    );
    expect(
      screen.getByText(t.UserDetail.pinExpires.replace("{date}", date)),
    ).toBeInTheDocument();
  });

  it("lets admins edit their own profile but not their own access", async () => {
    useQuery.mockImplementation(
      answerQueries({ "users:get": { ...grace, _id: "users_me" }, "roles:list": roles }),
    );
    renderDetail();

    expect(screen.getByText(t.UserDetail.self)).toBeInTheDocument();
    expect(screen.getByLabelText(t.UserForm.name)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.UserDetail.disable })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.UserDetail.resetPin })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("link", { name: t.UserDetail.changeOwnPassword })).toHaveAttribute(
        "href",
        "/change-password",
      ),
    );
  });
});
