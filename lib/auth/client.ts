"use client";

import { createContext, useContext } from "react";
import type { ClientErrorCode } from "./errors";

export type SignInResult = { ok: true } | { ok: false; code: ClientErrorCode };

/**
 * What the UI needs from the auth provider. Only lib/auth/better-auth-client.ts
 * knows it is Better Auth; adding OAuth or 2FA later means a new method here.
 * Session state comes from Convex (`useConvexAuth`), and password changes go
 * through `api.account.changePassword`, so neither is part of this interface.
 */
export interface AuthClient {
  /** `secret` is the password, or the one-time PIN before the first change. */
  signIn(email: string, secret: string): Promise<SignInResult>;
  signOut(): Promise<void>;
}

export const AuthClientContext = createContext<AuthClient | null>(null);

export function useAuthClient(): AuthClient {
  const client = useContext(AuthClientContext);
  if (client === null) throw new Error("useAuthClient needs an AuthClientContext provider");
  return client;
}
