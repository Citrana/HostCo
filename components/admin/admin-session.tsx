"use client";

import type { FunctionReturnType } from "convex/server";
import { createContext, useContext } from "react";
import type { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Permission } from "@/convex/lib/permissions";

export type AdminMe = NonNullable<FunctionReturnType<typeof api.account.me>>;

/** The signed-in user, provided by the admin shell once the session is known. */
export const AdminSessionContext = createContext<AdminMe | null>(null);

export function useAdminMe(): AdminMe {
  const me = useContext(AdminSessionContext);
  if (me === null) throw new Error("useAdminMe needs the admin shell");
  return me;
}

// These only decide what to show. Convex checks every call on its own.

export function can(me: AdminMe, permission: Permission) {
  return me.permissions.includes(permission);
}

/**
 * Mirrors the server rule: a role is assignable when the admin holds all of its
 * permissions, and the Super Admin role only by a Super Admin.
 */
export function canAssignRole(me: AdminMe, role: Doc<"roles">, roles: readonly Doc<"roles">[]) {
  if (role.isSystem) return roles.some((r) => r._id === me.roleId && r.isSystem);
  return role.permissions.every((permission) => can(me, permission));
}
