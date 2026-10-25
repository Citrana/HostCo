import { beforeEach, describe, expect, it, vi } from "vitest";

const signInEmail = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({ signIn: { email: signInEmail }, signOut }),
}));

const { betterAuthClient } = await import("./better-auth-client");

describe("betterAuthClient", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    signOut.mockReset();
  });

  it("signs in with the email and the password or PIN", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });

    await expect(betterAuthClient.signIn("a@example.com", "12345678")).resolves.toEqual({
      ok: true,
    });
    expect(signInEmail).toHaveBeenCalledWith({ email: "a@example.com", password: "12345678" });
  });

  it("returns the translated error code when Better Auth refuses", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "PIN_EXPIRED", status: 403 } });

    await expect(betterAuthClient.signIn("a@example.com", "12345678")).resolves.toEqual({
      ok: false,
      code: "PIN_EXPIRED",
    });
  });

  it("returns UNKNOWN when the request itself fails", async () => {
    signInEmail.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(betterAuthClient.signIn("a@example.com", "x")).resolves.toEqual({
      ok: false,
      code: "UNKNOWN",
    });
  });

  it("signs out", async () => {
    await betterAuthClient.signOut();

    expect(signOut).toHaveBeenCalledOnce();
  });
});
