import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`${name} is not set (see .env.example)`);
  return value;
}

// Server-only: forwards /api/auth/* to Better Auth on the Convex site URL.
export const { handler } = convexBetterAuthNextJs({
  convexUrl: required("NEXT_PUBLIC_CONVEX_URL", process.env.NEXT_PUBLIC_CONVEX_URL),
  convexSiteUrl: required("NEXT_PUBLIC_CONVEX_SITE_URL", process.env.NEXT_PUBLIC_CONVEX_SITE_URL),
});
