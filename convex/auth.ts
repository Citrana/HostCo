import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import type { ErrorCode } from "./lib/errors";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./lib/password";

export const authComponent = createClient<DataModel>(components.betterAuth);

const SIGN_IN_PATH = "/sign-in/email";

// Better Auth sends `{ code, message }`; the client translates `code` through
// `Errors.<code>` like any Convex error.
function authError(status: "FORBIDDEN" | "TOO_MANY_REQUESTS", code: ErrorCode) {
  return new APIError(status, { code, message: code });
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    database: authComponent.adapter(ctx),
    // Accounts are created by admins (or the one-time setup), never by visitors.
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: { [SIGN_IN_PATH]: { window: 15 * 60, max: 5 } },
    },
    hooks: {
      before: createAuthMiddleware(async (hookCtx) => {
        if (hookCtx.path !== SIGN_IN_PATH) return;
        const email: unknown = hookCtx.body?.email;
        if (typeof email !== "string" || !("runMutation" in ctx)) return;
        const allowed: boolean = await ctx.runMutation(internal.rateLimits.consumeSignInAttempt, {
          email,
        });
        if (!allowed) throw authError("TOO_MANY_REQUESTS", "TOO_MANY_ATTEMPTS");
      }),
    },
    databaseHooks: {
      session: {
        create: {
          // Runs after the password check, before any session exists.
          before: async (session) => {
            const reason: ErrorCode | null = await ctx.runQuery(internal.account.signInCheck, {
              authUserId: session.userId,
              now: Date.now(),
            });
            if (reason !== null) throw authError("FORBIDDEN", reason);
          },
        },
      },
    },
    plugins: [convex({ authConfig })],
  });
