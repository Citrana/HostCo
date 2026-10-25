import { execFileSync } from "node:child_process";

/**
 * Empties the Convex deployment the app points to, so `/setup` is available.
 * The mutation refuses to run unless that deployment has IS_TEST=true, which
 * keeps a mistaken run from wiping real data.
 */
export default function globalSetup() {
  execFileSync("pnpm", ["exec", "convex", "run", "testing:reset"], { stdio: "inherit" });
}
