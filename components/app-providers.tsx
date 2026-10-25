"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ComponentProps, ReactNode } from "react";
import { authClient, betterAuthClient } from "@/lib/auth/better-auth-client";
import { AuthClientContext } from "@/lib/auth/client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set (see .env.example)");
const convex = new ConvexReactClient(convexUrl);

// The provider's prop type is derived from better-auth 1.6.15's client generics
// and no longer matches later 1.6.x patches, although the runtime API is the
// same. We stay on the latest patch for its fixes and cast at this one boundary.
type ProviderAuthClient = ComponentProps<typeof ConvexBetterAuthProvider>["authClient"];
const providerAuthClient = authClient as unknown as ProviderAuthClient;

// No `initialToken`: reading the session cookie here would make every page
// dynamic. The client fetches its token on load instead.
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={providerAuthClient}>
      <AuthClientContext value={betterAuthClient}>{children}</AuthClientContext>
    </ConvexBetterAuthProvider>
  );
}
