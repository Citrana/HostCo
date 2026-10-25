// The docs name it unstable_doesProxyMatch; Next 16.4 still ships the old name.
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch as doesProxyMatch,
} from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";
import proxy, { config } from "./proxy";

const SESSION_COOKIE = "better-auth.session_token=abc.def";

function request(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  it.each(["/fr/admin", "/en/admin", "/fr/admin/users", "/en/change-password"])(
    "sends a visitor without a session from %s to sign-in",
    (path) => {
      const response = proxy(request(path));
      const locale = path.split("/")[1];

      expect(getRedirectUrl(response)).toBe(`http://localhost:3000/${locale}/sign-in`);
    },
  );

  it("lets a visitor with a session cookie through to the admin", () => {
    const response = proxy(request("/fr/admin", SESSION_COOKIE));

    expect(getRedirectUrl(response)).toBeNull();
  });

  it("accepts the secure cookie name used over HTTPS", () => {
    const response = proxy(request("/en/admin", `__Secure-${SESSION_COOKIE}`));

    expect(getRedirectUrl(response)).toBeNull();
  });

  it.each(["/fr", "/fr/sign-in", "/en/setup", "/fr/administration"])(
    "leaves the public page %s alone",
    (path) => {
      expect(getRedirectUrl(proxy(request(path)))).toBeNull();
    },
  );

  it("still adds the locale prefix to bare paths", () => {
    const response = proxy(
      new NextRequest("http://localhost:3000/admin", { headers: { "accept-language": "en" } }),
    );

    expect(getRedirectUrl(response)).toBe("http://localhost:3000/en/admin");
  });

  it("doesn't run on the auth API or static files", () => {
    expect(doesProxyMatch({ config, nextConfig, url: "/api/auth/sign-in/email" })).toBe(
      false,
    );
    expect(doesProxyMatch({ config, nextConfig, url: "/favicon.ico" })).toBe(false);
    expect(doesProxyMatch({ config, nextConfig, url: "/fr/admin" })).toBe(true);
  });
});
