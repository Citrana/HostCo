/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { ErrorCode } from "./lib/errors";
import type { Permission } from "./lib/permissions";
import schema from "./schema";

// The extra dot in this file name keeps Convex from deploying it.
const modules = import.meta.glob("./**/*.ts");

export function setupConvex() {
  return convexTest(schema, modules);
}

type TestConvex = ReturnType<typeof setupConvex>;

let nextUser = 0;

export async function createUser(
  t: TestConvex,
  options: {
    permissions?: Permission[];
    isSystem?: boolean;
    status?: "active" | "disabled";
    mustChangePassword?: boolean;
  } = {},
) {
  nextUser += 1;
  const authUserId = `auth-user-${nextUser}`;
  const { roleId, userId } = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      key: null,
      name: { fr: `Rôle ${nextUser}`, en: `Role ${nextUser}` },
      permissions: options.permissions ?? [],
      isSystem: options.isSystem ?? false,
    });
    const userId = await ctx.db.insert("users", {
      authUserId,
      name: `User ${nextUser}`,
      email: `user${nextUser}@example.com`,
      roleId,
      status: options.status ?? "active",
      mustChangePassword: options.mustChangePassword ?? false,
      pinExpiresAt: null,
      createdBy: null,
    });
    return { roleId, userId };
  });
  return {
    roleId: roleId as Id<"roles">,
    userId: userId as Id<"users">,
    as: t.withIdentity({ subject: authUserId }),
  };
}

export async function expectErrorCode(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toMatchObject({ data: { code } });
}
