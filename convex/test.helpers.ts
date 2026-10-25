/// <reference types="vite/client" />
import betterAuthTest from "@convex-dev/better-auth/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { expect } from "vitest";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { createCredentialUser } from "./lib/accounts";
import type { ErrorCode } from "./lib/errors";
import type { Permission } from "./lib/permissions";
import schema from "./schema";

// The extra dot in this file name keeps Convex from deploying it.
const modules = import.meta.glob("./**/*.ts");

export const SITE_URL = "http://localhost:3000";

export function setupConvex() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  rateLimiterTest.register(t);
  return t;
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
    roleId,
    userId,
    as: t.withIdentity({ subject: authUserId }),
  };
}

export async function expectErrorCode(promise: Promise<unknown>, code: ErrorCode) {
  await expect(promise).rejects.toMatchObject({ data: { code } });
}

/**
 * Creates a Better Auth credential user with a linked profile, the way the
 * bootstrap and (later) admin user creation do.
 */
export async function createAccount(
  t: TestConvex,
  options: {
    email?: string;
    password?: string;
    permissions?: Permission[];
    status?: "active" | "disabled";
    mustChangePassword?: boolean;
    pinExpiresAt?: number | null;
  } = {},
) {
  nextUser += 1;
  const email = options.email ?? `account${nextUser}@example.com`;
  const password = options.password ?? "correct-horse-battery";
  const { userId, authUserId } = await t.run(async (ctx) => {
    const roleId = await ctx.db.insert("roles", {
      key: null,
      name: { fr: `Rôle ${nextUser}`, en: `Role ${nextUser}` },
      permissions: options.permissions ?? [],
      isSystem: false,
    });
    const authUserId = await createCredentialUser(ctx, { name: `User ${nextUser}`, email, password });
    const userId = await ctx.db.insert("users", {
      authUserId,
      name: `User ${nextUser}`,
      email,
      roleId,
      status: options.status ?? "active",
      mustChangePassword: options.mustChangePassword ?? false,
      pinExpiresAt: options.pinExpiresAt ?? null,
      createdBy: null,
    });
    return { userId, authUserId };
  });
  return { email, password, userId, authUserId };
}

export async function signIn(
  t: TestConvex,
  email: string,
  password: string,
  options: { ip?: string } = {},
) {
  return await t.fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: SITE_URL,
      ...(options.ip === undefined ? {} : { "x-forwarded-for": options.ip }),
    },
    body: JSON.stringify({ email, password }),
  });
}

/** Signs in over HTTP and returns a test client acting with that session. */
export async function signedIn(t: TestConvex, email: string, password: string) {
  const response = await signIn(t, email, password);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { token: string; user: { id: string } };
  const sessionId = await sessionIdForToken(t, body.token);
  return {
    sessionId,
    token: body.token,
    as: t.withIdentity({ subject: body.user.id, sessionId }),
  };
}

export async function sessionIdForToken(t: TestConvex, token: string) {
  const session = await t.run(
    async (ctx): Promise<{ _id: string } | null> =>
      await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [{ field: "token", value: token }],
      }),
  );
  if (session === null) throw new Error("no session for token");
  return session._id;
}

export async function listSessions(t: TestConvex, authUserId: string) {
  const result = await t.run(
    async (ctx): Promise<{ page: { _id: string }[] }> =>
      await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: "session",
        where: [{ field: "userId", value: authUserId }],
        paginationOpts: { numItems: 100, cursor: null },
      }),
  );
  return result.page.map((session) => session._id);
}

export async function profileOf(t: TestConvex, userId: Id<"users">) {
  return await t.run((ctx) => ctx.db.get("users", userId));
}
