import { internalMutation } from "./_generated/server";
import { PERMISSIONS, type Permission } from "./lib/permissions";

type DefaultRole = {
  key: string;
  name: { fr: string; en: string };
  permissions: readonly Permission[];
  isSystem: boolean;
};

// The default matrix approved in .claude/plans/hostco-mvp.plan.md.
export const DEFAULT_ROLES: readonly DefaultRole[] = [
  {
    key: "superAdmin",
    name: { fr: "Super administrateur", en: "Super Admin" },
    permissions: PERMISSIONS,
    isSystem: true,
  },
  {
    key: "platformManager",
    name: { fr: "Responsable de la plateforme", en: "Platform Manager" },
    permissions: [
      "property.create",
      "property.update.own",
      "property.update.any",
      "property.delete",
      "property.publish",
      "property.view.any",
      "user.view",
      "location.manage",
    ],
    isSystem: false,
  },
  {
    key: "contentManager",
    name: { fr: "Gestionnaire de contenu", en: "Content Manager" },
    permissions: ["property.create", "property.update.own", "property.view.any"],
    isSystem: false,
  },
  {
    key: "moderator",
    name: { fr: "Modérateur", en: "Moderator" },
    permissions: ["property.view.any", "property.update.any", "property.publish"],
    isSystem: false,
  },
  {
    key: "verificationOfficer",
    name: { fr: "Agent de vérification", en: "Verification Officer" },
    permissions: ["property.view.any", "property.publish"],
    isSystem: false,
  },
  {
    key: "supportAgent",
    name: { fr: "Agent d’assistance", en: "Support Agent" },
    permissions: ["property.view.any", "user.view"],
    isSystem: false,
  },
  {
    key: "financeManager",
    name: { fr: "Responsable financier", en: "Finance Manager" },
    permissions: ["property.view.any"],
    isSystem: false,
  },
];

/**
 * Creates the default roles that are missing. Seeded roles that already exist
 * keep any edits an admin made, except the system role, which always gets
 * every permission back.
 */
export const seedRoles = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const role of DEFAULT_ROLES) {
      const existing = await ctx.db
        .query("roles")
        .withIndex("by_key", (q) => q.eq("key", role.key))
        .unique();
      if (existing === null) {
        await ctx.db.insert("roles", { ...role, permissions: [...role.permissions] });
      } else if (existing.isSystem) {
        await ctx.db.patch("roles", existing._id, { permissions: [...PERMISSIONS] });
      }
    }
    return null;
  },
});
