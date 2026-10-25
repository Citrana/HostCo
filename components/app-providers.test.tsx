import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@convex-dev/better-auth/react", () => ({
  ConvexBetterAuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("convex/react", () => ({ ConvexReactClient: class {} }));
vi.mock("@/lib/auth/better-auth-client", () => ({
  authClient: {},
  betterAuthClient: { name: "better-auth" },
}));

describe("AppProviders", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  it("gives the app the Better Auth client", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://demo.convex.cloud");
    const { AppProviders } = await import("./app-providers");
    // Imported after resetModules so it shares the provider's context instance.
    const { useAuthClient } = await import("@/lib/auth/client");
    function ShowsClient() {
      return <p>{(useAuthClient() as unknown as { name: string }).name}</p>;
    }

    render(
      <AppProviders>
        <ShowsClient />
      </AppProviders>,
    );

    expect(screen.getByText("better-auth")).toBeInTheDocument();
  });

  it("refuses to start without a Convex URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "");

    await expect(import("./app-providers")).rejects.toThrow(/NEXT_PUBLIC_CONVEX_URL/);
  });
});
