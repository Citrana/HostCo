# TDD evidence: PR 4, admin user management

## Source plan

`.claude/plans/hostco-mvp.plan.md`, sections "Permission model", "Auth design → PIN flow", "Screens" and "PR 4: `feat/admin-user-management`".

Deviations from the plan, and why:

- **`users.get` was added** next to `list`. The edit page needs one user. It and `roles.get` take `v.string()` and use `normalizeId`, so a mistyped URL shows "not found" instead of crashing `useQuery`.
- **Grant rule for user management.**
  - A `user.manage` holder can only create, edit, disable or reset users whose role they could grant: the role's permissions must be a subset of their own.
  - They can only assign such roles.
  - The Super Admin role is only grantable or manageable by a Super Admin.
  - Without this, a PIN reset on a Super Admin would hand over that account.
- **Nobody resets their own PIN or changes their own status (`FORBIDDEN`).**
  - A stolen session could otherwise swap the password without knowing it.
  - Because of this, the last-Super-Admin guard (`LAST_SUPER_ADMIN`) only matters for self-demotion. Anyone else who can disable or demote a Super Admin is a Super Admin too.
- **`roles.list` and `roles.get` now also accept `user.manage`.** Picking a role for a user needs the list.
- **`account.me` returns `id`, `roleId` and `permissions`.** The UI uses them only to decide what to show; Convex checks every call.
- **`users.update` takes an optional `roleId`.** A name-only save can't resend a stale role.
- **`testing:createPinUser` was removed.** PR 3 added it only until the admin UI existed. The e2e test now creates users through the UI.
- **Sign-out moved from the admin home into the account menu** in the new admin shell.

## User journeys

- As a Super Admin, I want to create a staff account and get a one-time PIN shown once, so that I can pass it on and nobody can read it later.
- As a staff member with a PIN, I want to sign in, replace it with my own password and land in the team area.
- As a Super Admin, I want to reset a forgotten password with a new PIN, so that the old password and every session stop working.
- As an admin, I want to change someone's name or role, or disable them, without being able to lock out the last Super Admin or grant more than I hold.
- As an admin, I want navigation that only shows what my role allows, and role screens with bilingual names and permission checkboxes.

## Task report

The pre-commit hook runs the full suite, and `--no-verify` is forbidden. So a commit can't hold a failing test, and each slice was committed once GREEN. The RED runs below were executed before the production code existed.

| Plan task | Test target | RED evidence | GREEN evidence |
|---|---|---|---|
| `users.list/get/create/update/setStatus/resetPin` | `convex/users.test.ts` | `pnpm exec vitest run --project convex`: 47 failed / 121 passed. 44 × `Could not find module for: "users"`, 2 × `me` missing `id`/`permissions`, 1 × `Validator error: Expected ID for table "roles", got 'not-an-id'` | 168 passed |
| `me.roleId` | `convex/account.test.ts` | `1 failed` (missing `roleId`) | 15 passed |
| Roles readable with `user.manage` | `convex/roles.test.ts` | `1 failed` (FORBIDDEN) | 33 passed |
| New error codes translated | `messages/errors.test.ts` | The pre-commit hook rejected the first commit: `["USER_NOT_FOUND", "LAST_SUPER_ADMIN"]` missing | passed |
| Admin shell, home, PIN dialog, user and role screens (FR + EN) | `components/admin/**/*.test.tsx` | 8 files: `Failed to resolve import "./admin-shell"` (and `./admin-session`, `./pin-dialog`, `./user-list`, `./user-create-form`, `./user-detail`, `./role-list`, `./role-form`) | 228 unit tests passed |
| Admin error boundary | `components/admin/admin-error.test.tsx` | `Failed to resolve import "./admin-error"` | 6 passed |
| e2e: create → PIN sign-in → forced change → admin; reset → old password fails | `e2e/auth.spec.ts` | not run (see "Known gaps") | not run |

`lib/i18n/use-locale-key.ts` was extracted during GREEN. Its test was written with it, not before.

## Final review (security-reviewer, typescript-reviewer)

Each fix below was test-first: RED, then GREEN.

| Finding | Reviewer | Decision | Evidence |
|---|---|---|---|
| The per-email sign-in limit checked, then recorded failures later, so parallel guesses all passed (MEDIUM, PR 3 code) | security | Fixed. The before-hook now takes a token in one mutation (`takeSignInAttempt`), and a successful sign-in clears the count. | RED: `expected [401 ×10] to have a length of 5 but got 10`. GREEN: 170 convex passed, twice. |
| A role manager could rewrite or delete a custom role that grants more than they hold (LOW) | security, typescript | Fixed. `getEditableRole` applies the grant rule. The UI shows such a role read-only, with a reason. | RED: 2 failed (resolved instead of FORBIDDEN). Four older tests were updated so their callers hold the permissions they edit. |
| A PIN that arrives after Next hides the page would resurface (LOW) | both | Fixed. `useOneTimePin` drops values that arrive while the page is hidden. | `user-create-form.test.tsx`: "doesn't keep a PIN that arrives while the page is hidden" |
| A new-role form stayed "saving" after create, under Activity (HIGH) | typescript | Fixed. The form resets before navigating. | "starts fresh and usable after creating a role" |
| Focus was lost when confirmations opened, after a failed delete, and after the PIN dialog closed (MEDIUM) | typescript | Fixed. Cancel takes focus, and focus returns to the trigger on every exit. | 3 new focus assertions |
| A stale `roleId` was sent on a name-only save (MEDIUM) | typescript | Fixed. `roleId` is optional server-side, and only sent when the admin picked another role. | Convex "keeps the role when only the name is sent"; component "leaves the role out…" |
| An empty role could be submitted in edit, and `roleId as Id<"roles">` casts were used (MEDIUM) | typescript | Fixed. There is validation, and the id is narrowed by lookup without casts. | "requires a role" |
| `setStatus` allowed self-disable (LOW-MEDIUM) | typescript | Fixed (`FORBIDDEN`). | "refuses to change the caller's own status" |
| The PIN wasn't in the dialog's accessible description (LOW-MEDIUM) | typescript | Fixed. | `toHaveAccessibleDescription` |
| Account menu: `aria-controls` dangling, no outside-click close, double sign-out (LOW) | typescript | Fixed. | 2 new shell tests |
| The inactive-account sign-out effect could re-fire (LOW) | typescript | Hardened with a run-once ref. | — |
| `groupOf` unchecked cast (style) | typescript | Removed (`startsWith`). | — |
| `resetPin` doesn't clear Better Auth's per-IP limiter (LOW) | security | Accepted. This is availability only, and the IP window expires in 15 minutes. | — |
| JWTs issued before a disable work again if the user is re-enabled within 15 minutes (LOW) | security | Accepted and documented. While disabled, `requireUser` refuses every call. After a reset, `mustChangePassword` blocks everything but the password change, which needs the current password. Closing it fully needs a `sessionsRevokedAt` check against the token's `iat`, a possible follow-up. | — |
| Last-admin check reads at most 500 holders; PIN left in the clipboard; Convex dashboard history shows mutation results (LOW) | security | Accepted. Treat dashboard access as PIN-visible. | — |
| Background behind the PIN dialog isn't `inert` (LOW) | typescript | Accepted. `aria-modal` plus the focus trap. | — |
| The client's Super Admin check depends on the caller's role being in `roles.list` (capped at 200) | typescript | Accepted. Roles are a short list. | — |

## Test specification

| # | What is guaranteed | Test file | Type |
|---|---|---|---|
| 1 | Each `users.*` function: allowed, denied (FORBIDDEN) and unauthenticated cases | `convex/users.test.ts` | convex |
| 2 | Create returns an 8-digit PIN once, the user must change it within 72 hours, and the PIN is never stored in plain text | `convex/users.test.ts` | convex |
| 3 | `EMAIL_TAKEN`, `EMAIL_INVALID`, `NAME_INVALID`, `ROLE_NOT_FOUND`, `USER_NOT_FOUND` | `convex/users.test.ts` | convex |
| 4 | Reset revokes every session, the old password fails, the new PIN works, and the sign-in lockout is lifted | `convex/users.test.ts` | convex |
| 5 | The last active Super Admin can't demote themselves; a disabled Super Admin doesn't count | `convex/users.test.ts` | convex |
| 6 | Non-system managers can't touch or assign roles beyond their own, nor the Super Admin role | `convex/users.test.ts`, `convex/roles.test.ts` | convex |
| 7 | The per-email sign-in limit holds under parallel attempts | `convex/auth.test.ts` | convex |
| 8 | Nav hides sections without permission; the current section is marked | `components/admin/admin-shell.test.tsx` | component (FR + EN) |
| 9 | The PIN dialog shows once, Copy works or explains failure, focus is trapped, and the PIN is forgotten on close or hide | `components/admin/users/pin-dialog.test.tsx`, `user-create-form.test.tsx`, `user-detail.test.tsx` | component (FR + EN) |
| 10 | Role permission checkboxes toggle, unheld permissions are disabled, and system, own and above-level roles are read-only | `components/admin/roles/role-form.test.tsx` | component (FR + EN) |
| 11 | Dates are formatted for the locale; server error codes are translated | `user-detail.test.tsx`, `admin-error.test.tsx` | component (FR + EN) |
| 12 | Admin creates a user → PIN sign-in → forced change → admin; reset → old password fails | `e2e/auth.spec.ts` | e2e (written, not yet run) |

## Coverage and known gaps

`pnpm exec vitest run --coverage`: 422 tests passing. Statements 97.66%, branches 94.95%, functions 99.57%, lines 99.24%.

The `PARSE_ERROR` printed during coverage comes from `convex/tsconfig.json` being picked up as source. It predates this PR.

`pnpm lint`: 0 errors. The 4 warnings are pre-existing, in `convex/_generated`. `pnpm typecheck` and `pnpm build` pass.

**`pnpm test:e2e` was not run.** Its global setup wipes the Convex deployment it points to, and needs `IS_TEST=true` there. The only configured deployment is the shared cloud dev deployment, so this waits for the owner's go-ahead.

## Merge evidence

If these commits are squashed, keep the RED/GREEN tables above in the PR body.
