import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const convexBetterAuthNextJs = vi.hoisted(() => vi.fn(() => ({ handler: { GET: vi.fn() } })));
vi.mock("@convex-dev/better-auth/nextjs", () => ({ convexBetterAuthNextJs }));

describe("auth server handler", () => {
  beforeEach(() => {
    vi.resetModules();
    convexBetterAuthNextJs.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("forwards to the Convex site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://demo.convex.cloud");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "https://demo.convex.site");

    const { handler } = await import("./server");

    expect(handler).toBeDefined();
    expect(convexBetterAuthNextJs).toHaveBeenCalledWith({
      convexUrl: "https://demo.convex.cloud",
      convexSiteUrl: "https://demo.convex.site",
    });
  });

  it("names the missing variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://demo.convex.cloud");
    vi.stubEnv("NEXT_PUBLIC_CONVEX_SITE_URL", "");

    await expect(import("./server")).rejects.toThrow(/NEXT_PUBLIC_CONVEX_SITE_URL/);
  });
});
