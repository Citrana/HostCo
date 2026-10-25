import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["components/**", "i18n/**", "lib/**", "convex/**"],
      // Route files (app/**) are Next server glue, covered by Playwright in e2e/.
      exclude: ["convex/_generated/**", "**/*.test.*"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["**/*.test.{ts,tsx}"],
          exclude: ["node_modules/**", "convex/**", "e2e/**"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "convex",
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          // Test-only values; real ones are set with `convex env set`.
          env: {
            SITE_URL: "http://localhost:3000",
            BETTER_AUTH_SECRET: "test-only-secret-that-is-long-enough-1234567890",
          },
          // The components register their modules with import.meta.glob, which Vite
          // only transforms in inlined dependencies.
          server: {
            deps: { inline: ["convex-test", "@convex-dev/better-auth", "@convex-dev/rate-limiter"] },
          },
        },
      },
    ],
  },
});
