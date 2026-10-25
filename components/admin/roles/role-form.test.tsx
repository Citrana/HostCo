import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminMe,
  answerQueries,
  LOCALES,
  mutations,
  navigation,
  renderAdmin,
} from "../test-utils";

const useQuery = vi.hoisted(() => vi.fn());
vi.mock("convex/react", async () => ({
  useQuery,
  useMutation: (await import("../test-utils")).mutations.useMutation,
}));
vi.mock("@/i18n/navigation", async () => (await import("../test-utils")).navigationMock);

const { RoleForm } = await import("./role-form");

const moderator = {
  _id: "roles_mod",
  key: "moderator",
  name: { fr: "Modérateur", en: "Moderator" },
  permissions: ["property.publish"],
  isSystem: false,
};
const superAdmin = {
  _id: "roles_sa",
  key: "superAdmin",
  name: { fr: "Super administrateur", en: "Super Admin" },
  permissions: [],
  isSystem: true,
};

describe.each(LOCALES)("RoleForm (%s)", (locale, messages) => {
  const t = messages.Admin;
  const p = t.Permissions;

  beforeEach(() => {
    mutations.reset();
    mutations.get("roles:create").mockResolvedValue("roles_new");
    mutations.get("roles:update").mockResolvedValue(null);
    mutations.get("roles:remove").mockResolvedValue(null);
    navigation.replace.mockReset();
    useQuery.mockReset().mockImplementation(answerQueries({ "roles:get": moderator }));
  });

  async function fillNames(fr: string, en: string) {
    const frField = screen.getByLabelText(t.RoleForm.nameFr);
    const enField = screen.getByLabelText(t.RoleForm.nameEn);
    await userEvent.clear(frField);
    await userEvent.clear(enField);
    if (fr) await userEvent.type(frField, fr);
    if (en) await userEvent.type(enField, en);
  }

  describe("new role", () => {
    it("creates a role with the checked permissions", async () => {
      renderAdmin(<RoleForm />, { locale });

      await fillNames("Rédacteur", "Writer");
      await userEvent.click(screen.getByRole("checkbox", { name: p.property.create }));
      await userEvent.click(screen.getByRole("checkbox", { name: p.property.update.own }));
      await userEvent.click(screen.getByRole("checkbox", { name: p.property.update.own }));
      await userEvent.click(screen.getByRole("checkbox", { name: p.user.view }));
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.create }));

      expect(mutations.get("roles:create")).toHaveBeenCalledWith({
        name: { fr: "Rédacteur", en: "Writer" },
        permissions: ["property.create", "user.view"],
      });
      expect(navigation.replace).toHaveBeenCalledWith("/admin/roles");
    });

    // With Cache Components the page stays alive, so "New role" comes back to it.
    it("starts fresh and usable after creating a role", async () => {
      renderAdmin(<RoleForm />, { locale });

      await fillNames("Rédacteur", "Writer");
      await userEvent.click(screen.getByRole("checkbox", { name: p.property.create }));
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.create }));

      await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
      expect(screen.getByLabelText(t.RoleForm.nameFr)).toHaveValue("");
      expect(screen.getByRole("checkbox", { name: p.property.create })).not.toBeChecked();
      expect(screen.getByRole("button", { name: t.RoleForm.create })).not.toHaveAttribute(
        "aria-disabled",
      );
    });

    it("groups the permissions by area", () => {
      renderAdmin(<RoleForm />, { locale });

      const users = screen.getByRole("group", { name: t.PermissionGroups.user });
      expect(within(users).getAllByRole("checkbox")).toHaveLength(2);
    });

    it("only lets the admin grant permissions they hold", () => {
      const me = adminMe({ roleId: "roles_other" as never, permissions: ["role.manage", "user.view"] });
      renderAdmin(<RoleForm />, { locale, me });

      expect(screen.getByRole("checkbox", { name: p.user.view })).toBeEnabled();
      expect(screen.getByRole("checkbox", { name: p.user.manage })).toBeDisabled();
      expect(screen.getByText(t.RoleForm.permissionsHint)).toBeInTheDocument();
    });

    it("requires both names", async () => {
      renderAdmin(<RoleForm />, { locale });

      await fillNames("", "");
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.create }));

      expect(screen.getAllByText(messages.Auth.required)).toHaveLength(2);
      expect(screen.getByLabelText(t.RoleForm.nameFr)).toHaveFocus();
      expect(mutations.get("roles:create")).not.toHaveBeenCalled();
    });

    it("shows server errors in the current language", async () => {
      mutations.get("roles:create").mockRejectedValue(new ConvexError({ code: "FORBIDDEN" }));
      renderAdmin(<RoleForm />, { locale });

      await fillNames("Rédacteur", "Writer");
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.create }));

      expect(await screen.findByRole("alert")).toHaveTextContent(messages.Errors.FORBIDDEN);
      expect(navigation.replace).not.toHaveBeenCalled();
    });
  });

  describe("existing role", () => {
    it("starts from the saved names and permissions, and saves changes", async () => {
      renderAdmin(<RoleForm id="roles_mod" />, { locale });

      expect(screen.getByLabelText(t.RoleForm.nameFr)).toHaveValue("Modérateur");
      expect(screen.getByRole("checkbox", { name: p.property.publish })).toBeChecked();
      await userEvent.click(screen.getByRole("checkbox", { name: p.property.publish }));
      await userEvent.click(screen.getByRole("checkbox", { name: p.property.view.any }));
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.save }));

      expect(mutations.get("roles:update")).toHaveBeenCalledWith({
        id: "roles_mod",
        name: moderator.name,
        permissions: ["property.view.any"],
      });
      expect(await screen.findByRole("status")).toHaveTextContent(t.RoleForm.saved);
    });

    it("deletes the role after confirmation", async () => {
      renderAdmin(<RoleForm id="roles_mod" />, { locale });

      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.delete }));
      expect(mutations.get("roles:remove")).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.deleteConfirm }));

      expect(mutations.get("roles:remove")).toHaveBeenCalledWith({ id: "roles_mod" });
      expect(navigation.replace).toHaveBeenCalledWith("/admin/roles");
    });

    it("explains that a role in use can't be deleted", async () => {
      mutations.get("roles:remove").mockRejectedValue(new ConvexError({ code: "ROLE_IN_USE" }));
      renderAdmin(<RoleForm id="roles_mod" />, { locale });

      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.delete }));
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.deleteConfirm }));

      expect(await screen.findByRole("alert")).toHaveTextContent(messages.Errors.ROLE_IN_USE);
      expect(navigation.replace).not.toHaveBeenCalled();
    });

    it("moves focus to Cancel when asking to confirm, and back when cancelled", async () => {
      renderAdmin(<RoleForm id="roles_mod" />, { locale });

      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.delete }));
      expect(screen.getByRole("button", { name: t.RoleForm.cancel })).toHaveFocus();
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.cancel }));

      expect(screen.getByRole("button", { name: t.RoleForm.delete })).toHaveFocus();
    });

    it("returns focus to Delete when the deletion fails", async () => {
      mutations.get("roles:remove").mockRejectedValue(new ConvexError({ code: "ROLE_IN_USE" }));
      renderAdmin(<RoleForm id="roles_mod" />, { locale });

      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.delete }));
      await userEvent.click(screen.getByRole("button", { name: t.RoleForm.deleteConfirm }));

      await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: t.RoleForm.delete })).toHaveFocus();
    });

    // The server refuses any save that keeps a permission the admin lacks.
    it("is read-only when the role grants permissions the admin lacks", () => {
      const me = adminMe({ roleId: "roles_other" as never, permissions: ["role.manage"] });
      renderAdmin(<RoleForm id="roles_mod" />, { locale, me });

      expect(screen.getByText(t.RoleForm.aboveLevel)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows the Super Admin role as locked, with every permission", () => {
      useQuery.mockImplementation(answerQueries({ "roles:get": superAdmin }));
      renderAdmin(<RoleForm id="roles_sa" />, { locale });

      expect(screen.getByText(t.RoleForm.locked)).toBeInTheDocument();
      const boxes = screen.getAllByRole("checkbox");
      expect(boxes).toHaveLength(10);
      boxes.forEach((box) => {
        expect(box).toBeChecked();
        expect(box).toBeDisabled();
      });
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("doesn't let admins edit their own role", () => {
      renderAdmin(<RoleForm id="roles_mod" />, {
        locale,
        me: adminMe({ roleId: "roles_mod" as never }),
      });

      // Exact text: the French copy has a non-breaking space before the colon.
      expect(
        screen.getByText((_, element) => element?.textContent === t.RoleForm.ownRole),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("says so when the role doesn't exist", () => {
      useQuery.mockImplementation(answerQueries({ "roles:get": null }));
      renderAdmin(<RoleForm id="nope" />, { locale });

      expect(screen.getByText(t.RoleForm.notFound)).toBeInTheDocument();
    });

    it("waits while the role loads", () => {
      useQuery.mockImplementation(answerQueries({}));
      renderAdmin(<RoleForm id="roles_mod" />, { locale });

      expect(screen.getByText(t.loading)).toBeInTheDocument();
    });
  });

  it("refuses a role without role.manage, without asking the server", () => {
    renderAdmin(<RoleForm id="roles_mod" />, { locale, me: adminMe({ permissions: ["user.view"] }) });

    expect(screen.getByRole("heading", { name: t.noAccess.title })).toBeInTheDocument();
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
  });
});
