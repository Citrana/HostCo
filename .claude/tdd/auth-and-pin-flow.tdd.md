# TDD evidence: PR 3, auth and PIN flow

## Source plan

`.claude/plans/hostco-mvp.plan.md`, sections "Auth design" and "PR 3: `feat/auth-and-pin-flow`".

Deviations from the plan, and why:

- **`bootstrapSuperAdmin` and `changePassword` are mutations, not actions.** Better Auth runs inside a Convex mutation through the component adapter. So the empty-table check, the auth account and the profile are one transaction (Convex serializability settles the race, and no lock table is needed). The password change and the clearing of `mustChangePassword` also commit or fail together.
- **The `AuthClient` interface has only `signIn` and `signOut`.** Password changes go through `api.account.changePassword`, so the flag can only clear on the server. Session state comes from `useConvexAuth`.
- **Better Auth account operations live in `convex/lib/accounts.ts`, not `convex/lib/auth.ts`.** `schema.ts` imports `lib/auth.ts` indirectly, and Convex evaluates the schema without bundled dependencies.
- **The plan mentions a `PIN_EXPIRED` session hook; it also rejects disabled accounts (`ACCOUNT_DISABLED`).**
- **A minimal `/[locale]/admin` page exists** (a welcome line and sign-out), so sign-in has a destination. PR 4 replaces it with the admin shell.

## First commit: review of PR 2's `convex/` code

`typescript-reviewer`, `database-reviewer` and `security-reviewer` all flagged the same real defect: a `role.manage` holder could grant permissions they don't hold, including by editing their own role.

| Finding | Decision | Evidence |
|---|---|---|
| Privilege escalation through `roles.create` and `roles.update` (all three reviewers) | Fixed. A caller can only grant permissions they hold (the system role holds all), and can't edit or delete their own role (`FORBIDDEN`). | RED: 3 failing (`promise resolved … instead of rejecting`). GREEN: 49 convex tests passing. |
| The seed silently re-creates a default role an admin deleted (database, typescript) | Documented in the `seedRoles` comment and locked in with a test. | `seed.test.ts`: "re-creates a default role that an admin deleted" |
| Redundant `as Id<…>` casts and `!` assertions in tests (typescript) | Fixed. | — |
| `mustChangePassword` blocks every `requirePermission` caller (all three) | Handled in PR 3 by `requireUser`. | `account.test.ts` |
| Duplicate `authUserId` would make `.unique()` throw an uncoded error | Prevented at creation: `createCredentialUser` throws `EMAIL_TAKEN`, and bootstrap only runs on an empty table. | `setup.test.ts` |
| Use `tokenIdentifier` instead of `subject` | Not changed. The Convex plugin's JWT `subject` is the Better Auth user id, which admin operations need, and there is a single fixed issuer. | Verified in `@convex-dev/better-auth` `createClient.safeGetAuthUser`. |
| Role names aren't unique; `roles.list` caps at 200 | Not defects for an admin-managed list. | — |

## User journeys

- As the first person to deploy hostco, I want to create the Super Admin account once, so that nobody else can claim the platform afterwards.
- As a staff member, I want to sign in with my email and my password or one-time PIN, and see errors in my language.
- As a staff member with a PIN, I want to replace it with my own password, so that the PIN stops working and my other sessions end.
- As the platform, I want sign-in limited per email and per IP, expired PINs and disabled accounts refused, and signed-out visitors kept out of the team area.

## Task report

| Plan task | Test target | RED evidence | GREEN evidence |
|---|---|---|---|
| PIN generator, PIN expiry, password rules | `convex/lib/pin.test.ts`, `password.test.ts` | `Cannot find module './pin'` / `'./password'` | passing |
| Setup (`status`, `bootstrapSuperAdmin`) | `convex/setup.test.ts` | `Could not find module for: "setup"` | 13 passing |
| `account.me`, `account.changePassword` | `convex/account.test.ts` | `Could not find module for: "account"` | 11 passing |
| Sign-in hooks over real HTTP (`t.fetch`) | `convex/auth.test.ts` | `createCredentialUser is not a function`; 429 without our code | 7 passing |
| Convex RED run overall | `pnpm exec vitest run --project convex` | `28 failed / 50 passed`, every failure a missing module or function | `92 passed` |
| Client error mapping | `lib/auth/errors.test.ts`, `messages/errors.test.ts` | `Failed to resolve import "./errors"` | passing |
| `proxy.ts` redirects | `proxy.test.ts` | `expected null to be 'http://localhost:3000/fr/sign-in'` (4 failing) | 12 passing |
| Sign-in, setup and change-password forms and admin home (FR + EN) | `components/**/**.test.tsx` | `Failed to resolve import "./sign-in-form"` (×4 files) | 44 passing |
| e2e reset gate | `convex/testing.test.ts` | `Could not find module for: "testing"` | 2 passing |

`lib/auth/better-auth-client.ts`, `server.ts` and `components/app-providers.tsx` are thin adapters. Their tests were written alongside them, not before, so there is no RED run for those three.

### Bugs found by e2e, fixed test-first

1. **One shared rate-limit bucket.** Better Auth 1.6.33 puts every request without a client IP into one bucket per path, so five failed sign-ins by anyone would lock out all staff. Regression test: "doesn't put clients without a known IP in one shared bucket", RED (`expected 429 to be 200`) and then GREEN. Fix: the per-IP rule is skipped when the request has no `x-forwarded-for`. The per-email limit always applies.
2. **The team area bounced back to sign-in after signing in.** Better Auth refreshes the session in the background, and `isPending` stays false during a refetch, so the provider briefly reports "signed out". RED: the form tests expected a full page load. GREEN: `useOpenPage` loads `/admin` with a full navigation after sign-in and after setup.

3. **Nested auth paths were still on the shared bucket.** Better Auth's `*` wildcard matches only one path segment, so `/convex/jwks` and `/convex/token` (used to validate every token) still fell back to the shared bucket. Regression test: 101 IP-less JWKS requests, RED (`expected [ 429 ] to deeply equal []`) and then GREEN with `/**`.
4. **Saving a new password left the user stuck on the change-password page.** The mutation succeeded (confirmed in the WebSocket trace). But with Cache Components, Next keeps visited routes in a hidden `<Activity>`, so the old `/admin` came back with its stale "must change password" state and redirected again. Following Next's "Preserving UI state" guide, every auth transition (after sign-in, setup, password change and sign-out) now does a full page load. RED and GREEN are in the component tests, and e2e test 10 covers it.

The same e2e run confirmed that scrypt verify plus hash fits inside one Convex mutation on a real backend (`MutationResponse … {"ok":true}`). The TypeScript reviewer had flagged this.

## Final review (security-reviewer, typescript-reviewer)

| Finding | Reviewer | Decision |
|---|---|---|
| The per-email limiter counts successful sign-ins, which makes lockouts easy (MEDIUM) | both | Fixed. Only failed attempts count (an after-hook records `INVALID_EMAIL_OR_PASSWORD`). Deliberate failures can still lock one account for 15 minutes, which is inherent to per-account limits. PR 4's "reset PIN" is the recovery path. |
| Better Auth's other HTTP routes (`/change-password`, `/update-user`…) bypass the app's rules (MEDIUM) | security | Fixed. An allowlist of HTTP paths returns 404 for everything else. Server-side `auth.api` calls are unaffected (tested). |
| Arbitrary strings become limiter keys (LOW) | security | Fixed. `signInLimitKey` only keys valid emails of 254 characters or fewer. |
| No throttle on `account.changePassword` (LOW) | security | Fixed. 5 failed attempts per user per 15 minutes. A wrong password is returned, not thrown, so the count isn't rolled back. |
| `x-forwarded-for` is spoofable (LOW) | both | Documented in `.env.example`. The per-email limit is the real guard. |
| Whoever reaches `/setup` first on a fresh deployment owns it (LOW) | security | Accepted, by design in the plan. A `SETUP_TOKEN` env var is possible later hardening. |
| `account.me` throws during render for a disabled or missing profile (HIGH) | typescript | Fixed. `me` returns `null`, and the team area then signs out and leaves. |
| Sign-out has no error handling (MEDIUM) | typescript | Fixed. It shows a translated error and stays on the page. |
| A `disabled` submit button drops keyboard focus (MEDIUM) | typescript | Fixed. It uses `aria-disabled`, and the forms ignore repeat submits. |
| Field errors aren't announced (MEDIUM) | typescript | Fixed. Focus moves to the first invalid field, which `aria-describedby` links to its error. |
| scrypt inside a mutation could exceed limits (MEDIUM) | typescript | Verified on a real backend with the new e2e test (see above). |
| The `as unknown as` cast on the provider's auth client (MEDIUM) | typescript | Kept and documented. Pinning better-auth to 1.6.15 would drop 18 patch releases. The e2e tests exercise this boundary in a real browser. |
| The `useLocale()` cast; the hook fails open outside an action context (LOW) | typescript | Fixed. A `hasLocale` guard, and `requireActionCtx` now throws. |
| `setup` silently goes to sign-in if the automatic sign-in fails (LOW) | typescript | Accepted. It's rare, and the sign-in page then shows the real error. |

No RED checkpoint commits: the Husky pre-commit hook runs `pnpm test` and must not be bypassed (CLAUDE.md). This report records the RED evidence instead.

## Test specification

| # | What is guaranteed | Test | Type |
|---|---|---|---|
| 1 | The first Super Admin is created once, including when two attempts race; later calls get `SETUP_ALREADY_DONE` | `convex/setup.test.ts` | convex |
| 2 | The bootstrap seeds the 7 default roles and the admin can sign in right away | `convex/setup.test.ts` | convex |
| 3 | No app or auth document contains the plaintext password | `convex/setup.test.ts` | convex |
| 4 | PINs are 8 digits, unbiased (rejection sampling), and expire after 72 h | `convex/lib/pin.test.ts` | convex |
| 5 | An expired PIN gets `PIN_EXPIRED` and creates no session; a disabled account gets `ACCOUNT_DISABLED` | `convex/auth.test.ts` | convex (HTTP) |
| 6 | 5 attempts per email in 15 minutes (case-insensitive, across IPs), and 5 per IP | `convex/auth.test.ts` | convex (HTTP) |
| 7 | Clients without a known IP don't share a rate-limit bucket | `convex/auth.test.ts` | convex (HTTP) |
| 8 | Public sign-up stays closed | `convex/auth.test.ts` | convex (HTTP) |
| 9 | Changing the password clears the flag and `pinExpiresAt`, the old PIN stops working, and the other sessions are revoked but the current one isn't | `convex/account.test.ts` | convex |
| 10 | A wrong current password (`INVALID_CREDENTIALS`), a reused one (`PASSWORD_REUSED`) or a short one (`PASSWORD_TOO_SHORT`) changes nothing | `convex/account.test.ts` | convex |
| 11 | `account.me` works while a password change is pending; it rejects disabled and anonymous callers | `convex/account.test.ts` | convex |
| 12 | `testing:reset` refuses to run without `IS_TEST=true` | `convex/testing.test.ts` | convex |
| 13 | Without a session cookie, `/admin*` and `/change-password` redirect to `/{locale}/sign-in`; public pages and `/api` are untouched | `proxy.test.ts` | unit |
| 14 | Every error code the client can show is translated in FR and EN | `messages/errors.test.ts` | unit |
| 15 | The three forms validate in the user's language and show translated server errors (FR + EN) | `components/auth/*.test.tsx` | component |
| 16 | The team area greets the user in their language, sends a PIN user to change it, and signs out | `components/admin/admin-home.test.tsx` | component |
| 17 | Setup → team area → sign out → sign in works in a real browser; `/setup` is then closed; a wrong password shows a translated error | `e2e/auth.spec.ts` | e2e |
| 18 | A PIN user is sent to change it, lands in the team area, and the PIN then stops working | `e2e/auth.spec.ts` | e2e |
| 19 | Only the auth routes the app uses are reachable over HTTP | `convex/auth.test.ts` | convex (HTTP) |
| 20 | 5 failed password-change attempts block further attempts, even with the right password | `convex/account.test.ts` | convex |

## Coverage and known gaps

`pnpm exec vitest run --coverage`: 230 tests passing. Statements 97.14%, branches 95.06%, functions 99.09%, lines 98.55%. The only folder under 90% is `i18n/` (83%), which this PR doesn't change. `pnpm test:e2e`: 10 passed.

- e2e runs against a local Convex backend with `IS_TEST=true` (see `.env.example`). `e2e/global-setup.ts` calls `testing:reset`, which refuses to run on any other deployment.
- Per-IP limiting trusts `x-forwarded-for`, which a client can spoof. The per-email limit is the real guard against password guessing.
- The rate limiter's counters aren't wiped by `testing:reset`, so e2e uses a fresh email on each run.
