# TDD evidence: PR 2, roles and permissions

## Source plan

`.claude/plans/hostco-mvp.plan.md`, section "PR 2: `feat/roles-and-permissions`", with the default permission matrix from "Permission model".

## User journeys

- As a Super Admin, I want every back-office function to check permissions on the server, so that the UI can't be used to bypass security.
- As a Super Admin (or anyone with `role.manage`), I want to create, edit and delete custom roles, so that I can match permissions to how the team works.
- As a staff member with `user.view`, I want to see the roles, so that I can understand who can do what.
- As the platform, I want the seven default roles seeded once, so that a fresh deployment starts with the approved matrix.

## Task report

| Plan task | Test target | RED evidence | GREEN evidence |
|---|---|---|---|
| `requirePermission` | `convex/lib/permissions.test.ts` | `requirePermission` / `requireAnyPermission` not defined (10 failing) | 11 passing |
| `roles.ts` CRUD | `convex/roles.test.ts` | `Could not find module for: "roles"` (26 failing) | 26 passing |
| `seed.ts` | `convex/seed.test.ts` | module `seed` missing (6 failing) | 6 passing |
| `Errors.*` keys | `messages/errors.test.ts` | no `Errors` keys in fr/en (2 failing) | 2 passing |

RED run (`pnpm test`, after adding the schema, `ERROR_CODES` and `PERMISSIONS` only): `44 failed | 28 passed`. Every failure was a missing implementation or missing translation, not a setup error.
GREEN run (`pnpm test`): `Test Files 9 passed (9)`, `Tests 72 passed (72)`.

No RED checkpoint commit: the Husky pre-commit hook runs `pnpm test` and must not be bypassed (CLAUDE.md), so a commit with failing tests can't exist. This report records the RED evidence instead.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | A user whose role holds the permission gets `{ user, role }` back | `permissions.test.ts` | convex | PASS |
| 2 | A missing permission throws `FORBIDDEN` | `permissions.test.ts` | convex | PASS |
| 3 | No identity, or an identity without a profile, throws `UNAUTHENTICATED` | `permissions.test.ts` | convex | PASS |
| 4 | A disabled user gets `ACCOUNT_DISABLED`, even with the permission | `permissions.test.ts` | convex | PASS |
| 5 | A user who must change their password gets `PASSWORD_CHANGE_REQUIRED` | `permissions.test.ts` | convex | PASS |
| 6 | A user whose role was deleted gets `FORBIDDEN` | `permissions.test.ts` | convex | PASS |
| 7 | The system role passes every permission | `permissions.test.ts` | convex | PASS |
| 8 | `roles.list` / `roles.get` allow `user.view` or `role.manage`, forbid others, reject anonymous callers | `roles.test.ts` | convex | PASS |
| 9 | `roles.create` / `update` / `remove` need `role.manage` and reject anonymous callers | `roles.test.ts` | convex | PASS |
| 10 | Role names are trimmed, required in both languages, at most 60 characters (`ROLE_INVALID`) | `roles.test.ts` | convex | PASS |
| 11 | An unknown permission is rejected by the argument validator | `roles.test.ts` | convex | PASS |
| 12 | The system role can't be edited or deleted (`SYSTEM_ROLE_LOCKED`) | `roles.test.ts` | convex | PASS |
| 13 | A role still assigned to a user can't be deleted (`ROLE_IN_USE`) | `roles.test.ts` | convex | PASS |
| 14 | A missing role gives `ROLE_NOT_FOUND` on update/remove and `null` on get | `roles.test.ts` | convex | PASS |
| 15 | The seed creates the 7 roles with exactly the approved matrix, Super Admin as the only system role | `seed.test.ts` | convex | PASS |
| 16 | The seed is idempotent, keeps admin edits, and restores Super Admin's full permissions | `seed.test.ts` | convex | PASS |
| 17 | Every Convex error code is translated in French and English | `messages/errors.test.ts` | unit | PASS |

## Coverage and known gaps

`pnpm test --coverage`: statements 99.1%, branches 97.87%, functions 100%, lines 99%. Every new production file is at 100%.

- `requirePropertyEdit` from the plan's permission model is left for PR 5, when the `properties` table exists.
- `convex/lib/auth.ts` reads `identity.subject` for now. PR 3 points it at Better Auth.
- Nothing calls `seed:seedRoles` automatically yet. Run it with `pnpm exec convex run seed:seedRoles`. PR 3's bootstrap can call it.
- Pre-existing noise, not from this PR: the coverage run prints a `PARSE_ERROR` for `convex/tsconfig.json`, because the coverage `include` glob `convex/**` matches it.
