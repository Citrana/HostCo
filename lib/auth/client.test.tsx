import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeAuthClient } from "@/components/auth/test-utils";
import { AuthClientContext, useAuthClient } from "./client";

describe("useAuthClient", () => {
  it("returns the client from the context", () => {
    const auth = fakeAuthClient();
    const { result } = renderHook(() => useAuthClient(), {
      wrapper: ({ children }) => <AuthClientContext value={auth}>{children}</AuthClientContext>,
    });

    expect(result.current).toBe(auth);
  });

  it("fails loudly without a provider", () => {
    expect(() => renderHook(() => useAuthClient())).toThrow(/AuthClientContext/);
  });
});
