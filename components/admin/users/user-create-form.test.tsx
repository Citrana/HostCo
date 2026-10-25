import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminMe, answerQueries, LOCALES, mutations, navigation, renderAdmin } from "../test-utils";

const useQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () => ({
  useQuery,
  useMutation: (await import("../test-utils")).mutations.useMutation,
}));
vi.mock("@/i18n/navigation", async () => (await import("../test-utils")).navigationMock);

const { UserCreateForm } = await import("./user-create-form");

const roles = [
  { _id: "roles_me", key: "superAdmin", name: { fr: "Super administrateur", en: "Super Admin" }, permissions: [], isSystem: true },
  { _id: "roles_mod", key: "moderator", name: { fr: "Modérateur", en: "Moderator" }, permissions: ["property.publish"], isSystem: false },
  { _id: "roles_support", key: "supportAgent", name: { fr: "Agent d’assistance", en: "Support Agent" }, permissions: ["user.view"], isSystem: false },
];

describe.each(LOCALES)("UserCreateForm (%s)", (locale, messages) => {
  const t = messages.Admin;
  beforeEach(() => {
    mutations.reset();
    mutations.get("users:create").mockResolvedValue({ id: "users_new", pin: "40719263" });
    navigation.replace.mockReset();
    useQuery.mockReset().mockImplementation(answerQueries({ "roles:list": roles }));
  });

  async function fill(name: string, email: string, roleName?: string) {
    if (name) await userEvent.type(screen.getByLabelText(t.UserForm.name), name);
    if (email) await userEvent.type(screen.getByLabelText(t.UserForm.email), email);
    if (roleName) {
      await userEvent.selectOptions(screen.getByLabelText(t.UserForm.role), roleName);
    }
    await userEvent.click(screen.getByRole("button", { name: t.UserNew.submit }));
  }

  it("requires every field and moves focus to the first one", async () => {
    renderAdmin(<UserCreateForm />, { locale });

    await fill("", "");

    expect(screen.getAllByText(messages.Auth.required)).toHaveLength(3);
    expect(screen.getByLabelText(t.UserForm.name)).toHaveFocus();
    expect(mutations.get("users:create")).not.toHaveBeenCalled();
  });

  it("refuses an invalid email", async () => {
    renderAdmin(<UserCreateForm />, { locale });

    await fill("Grace Mbuyi", "grace@", roles[1].name[locale]);

    expect(screen.getByText(messages.Errors.EMAIL_INVALID)).toBeInTheDocument();
  });

  it("only offers the roles the admin may assign", () => {
    // Not a Super Admin: can't hand out the Super Admin role, nor user.view.
    const me = adminMe({ roleId: "roles_other" as never, permissions: ["user.manage", "property.publish"] });
    renderAdmin(<UserCreateForm />, { locale, me });

    const select = screen.getByLabelText(t.UserForm.role);
    const options = within(select).getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual([t.UserForm.rolePlaceholder, roles[1].name[locale]]);
  });

  it("creates the user and shows their PIN once", async () => {
    renderAdmin(<UserCreateForm />, { locale });

    await fill("Grace Mbuyi", "Grace@Example.com", roles[1].name[locale]);

    expect(mutations.get("users:create")).toHaveBeenCalledWith({
      name: "Grace Mbuyi",
      email: "grace@example.com",
      roleId: "roles_mod",
    });
    const dialog = await screen.findByRole("alertdialog", { name: t.Pin.title });
    expect(dialog).toHaveTextContent("40719263");

    await userEvent.click(within(dialog).getByRole("button", { name: t.Pin.done }));

    expect(screen.queryByText("40719263")).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith("/admin/users/users_new");
  });

  // With Cache Components, Next keeps visited pages alive but hidden.
  it("forgets the PIN as soon as the page is hidden", async () => {
    const { rerender } = renderAdmin(
      <Activity mode="visible">
        <UserCreateForm />
      </Activity>,
      { locale },
    );
    await fill("Grace Mbuyi", "grace@example.com", roles[1].name[locale]);
    await screen.findByRole("alertdialog");

    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <UserCreateForm />
      </Activity>
    );
    rerender(page("hidden"));
    rerender(page("visible"));

    expect(screen.queryByText("40719263")).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.UserForm.name)).toHaveValue("");
  });

  it("doesn't keep a PIN that arrives while the page is hidden", async () => {
    let finish: (value: { id: string; pin: string }) => void = () => {};
    mutations.get("users:create").mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const page = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <UserCreateForm />
      </Activity>
    );
    const { rerender } = renderAdmin(page("visible"), { locale });
    await fill("Grace Mbuyi", "grace@example.com", roles[1].name[locale]);

    rerender(page("hidden"));
    await act(async () => finish({ id: "users_new", pin: "40719263" }));
    rerender(page("visible"));

    expect(screen.queryByText("40719263")).not.toBeInTheDocument();
  });

  it("shows server errors in the current language", async () => {
    mutations.get("users:create").mockRejectedValue(new ConvexError({ code: "EMAIL_TAKEN" }));
    renderAdmin(<UserCreateForm />, { locale });

    await fill("Grace Mbuyi", "grace@example.com", roles[1].name[locale]);

    expect(await screen.findByRole("alert")).toHaveTextContent(messages.Errors.EMAIL_TAKEN);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("refuses a role without user.manage", () => {
    renderAdmin(<UserCreateForm />, { locale, me: adminMe({ permissions: ["user.view"] }) });

    expect(screen.getByRole("heading", { name: t.noAccess.title })).toBeInTheDocument();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });

  it("waits while the roles load", async () => {
    useQuery.mockImplementation(answerQueries({}));
    renderAdmin(<UserCreateForm />, { locale });

    await waitFor(() => expect(screen.getByText(t.loading)).toBeInTheDocument());
  });
});
