import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlProxy = createMiddleware(routing);

// Pages that need a session. Matching `/{locale}/admin` and `/{locale}/admin/...`
// but not e.g. `/{locale}/administration`.
const PROTECTED = new RegExp(
  `^/(${routing.locales.join("|")})/(admin|change-password)(/|$)`,
);

/**
 * Optimistic check only: a missing session cookie goes to sign-in. Whether the
 * session is valid, and what the user may do, is checked by Convex.
 */
export default function proxy(request: NextRequest) {
  const match = PROTECTED.exec(request.nextUrl.pathname);
  if (match !== null && getSessionCookie(request) === null) {
    return NextResponse.redirect(new URL(`/${match[1]}/sign-in`, request.url));
  }
  return intlProxy(request);
}

export const config = {
  // Skip Next internals, API routes and files with an extension.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
