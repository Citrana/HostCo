"use client";

import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { AuthClient } from "./client";
import { toErrorCode } from "./errors";

// Same origin: app/api/auth/[...all] forwards to the Convex HTTP routes.
export const authClient = createAuthClient({ plugins: [convexClient()] });

export const betterAuthClient: AuthClient = {
  async signIn(email, secret) {
    try {
      const { error } = await authClient.signIn.email({ email, password: secret });
      return error ? { ok: false, code: toErrorCode(error) } : { ok: true };
    } catch (error) {
      return { ok: false, code: toErrorCode(error) };
    }
  },
  async signOut() {
    await authClient.signOut();
  },
};
