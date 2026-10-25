import { isAPIError } from "better-auth/api";
import { authComponent, createAuth } from "../auth";
import type { MutationCtx } from "../_generated/server";
import { appError } from "./errors";

// Account operations that go through Better Auth. Kept apart from ./auth.ts,
// which the schema imports indirectly and so must not pull in Better Auth.

/**
 * Creates a Better Auth user with an email/password credential and returns its
 * id. Public sign-up is disabled, so this goes through the internal adapter the
 * way Better Auth's own sign-up route does. The password is hashed (scrypt)
 * before it is stored.
 */
export async function createCredentialUser(
  ctx: MutationCtx,
  user: { name: string; email: string; password: string },
): Promise<string> {
  const auth = await createAuth(ctx).$context;
  if ((await auth.internalAdapter.findUserByEmail(user.email)) !== null) {
    throw appError("EMAIL_TAKEN");
  }
  const hash = await auth.password.hash(user.password);
  const created = await auth.internalAdapter.createUser({
    name: user.name,
    email: user.email,
    emailVerified: false,
  });
  await auth.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: hash,
  });
  return created.id;
}

/** Changes the caller's password and signs out their other sessions. */
export async function changeOwnPassword(
  ctx: MutationCtx,
  passwords: { currentPassword: string; newPassword: string },
) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) throw appError("UNAUTHENTICATED");
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
  try {
    await auth.api.changePassword({ body: passwords, headers });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_PASSWORD") {
      throw appError("INVALID_CREDENTIALS");
    }
    throw error;
  }

  const context = await auth.$context;
  const sessions = await context.internalAdapter.listSessions(identity.subject);
  const others = sessions.filter((session) => session.id !== identity.sessionId);
  if (others.length > 0) {
    await context.internalAdapter.deleteSessions(others.map((session) => session.token));
  }
}
