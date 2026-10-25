# hostco MVP plan

## Context

hostco is a fresh Next.js 16 + Convex + next-intl repo. It has the home page boilerplate in FR/EN, an empty `convex/` and no schema. The MVP adds four things:

- a public catalogue of published properties
- a closed staff back office: no public signup, accounts created by an admin, one-time PINs
- role-based permissions that a Super Admin can edit
- bilingual property management

The visual reference is `docs/design/inspiration.png`. That file is still untracked, so PR 1 commits it.

Decisions already made:
- **Auth library:** Better Auth through `@convex-dev/better-auth`, wrapped behind our own interface.
- **Locations:** a seeded table of provinces and cities that admins can extend later.
- **Country:** assumed to be the DRC (French, USD, provinces). Please confirm.

Each PR runs `pnpm lint`, `pnpm typecheck`, `pnpm test` (coverage ≥ 80%) and `pnpm build`. PRs that change a user flow also run `pnpm test:e2e`. Every PR fills `.github/PULL_REQUEST_TEMPLATE.md` and targets `develop`.

**Step 0 (after this plan is accepted):** copy this plan to `.claude/plans/hostco-mvp.plan.md`. Then open it with `/ecc:plan-canvas` so you can annotate and approve the **permission matrix** before PR 2 starts.

---

## Data model (Convex)

Better Auth's tables (user, account, session, verification, rateLimit) live inside the component. The app keeps its own profile and domain tables.

```ts
// convex/schema.ts (sketch)
const localized = v.object({ fr: v.string(), en: v.string() });

roles: defineTable({
  key: v.union(v.string(), v.null()),      // "superAdmin" etc. for seeded roles, null for custom
  name: localized,
  permissions: v.array(permissionValidator), // union of v.literal(...)
  isSystem: v.boolean(),                     // Super Admin: locked, all permissions, not deletable
}).index("by_key", ["key"]),

users: defineTable({                         // app profile, 1:1 with Better Auth user
  authUserId: v.string(),
  name: v.string(),
  email: v.string(),                         // lowercased
  roleId: v.id("roles"),
  status: v.union(v.literal("active"), v.literal("disabled")),
  mustChangePassword: v.boolean(),
  pinExpiresAt: v.union(v.number(), v.null()),
  createdBy: v.union(v.id("users"), v.null()), // null only for the bootstrap Super Admin
}).index("by_authUserId", ["authUserId"]).index("by_email", ["email"]).index("by_roleId", ["roleId"]),

provinces: defineTable({ slug: v.string(), name: localized }).index("by_slug", ["slug"]),
cities: defineTable({ provinceId: v.id("provinces"), slug: v.string(), name: localized })
  .index("by_provinceId", ["provinceId"]).index("by_slug", ["slug"]),

properties: defineTable({
  title: localized,
  description: localized,
  listingType: v.union(v.literal("rent"), v.literal("sale")),
  priceCents: v.number(),                    // USD integer cents; rent = per month
  address: v.object({ provinceId: v.id("provinces"), cityId: v.id("cities"),
                      neighborhood: v.string(), street: v.string() }),
  bedrooms: v.number(), bathrooms: v.number(), sizeSqm: v.number(),
  contact: v.object({ phone: v.union(v.string(), v.null()),
                      whatsapp: v.union(v.string(), v.null()),
                      email: v.union(v.string(), v.null()) }), // at least one, checked server-side
  status: v.union(v.literal("draft"), v.literal("published"), v.literal("closed")),
  createdBy: v.id("users"),
  updatedAt: v.number(),
  publishedAt: v.union(v.number(), v.null()),
})                                            // createdAt = _creationTime
  .index("by_status_and_priceCents", ["status", "priceCents"])
  .index("by_status_and_listingType_and_priceCents", ["status", "listingType", "priceCents"])
  .index("by_status_and_address.cityId_and_priceCents", ["status", "address.cityId", "priceCents"])
  .index("by_status_and_listingType_and_address.cityId_and_priceCents",
         ["status", "listingType", "address.cityId", "priceCents"])
  .index("by_createdBy", ["createdBy"]),

propertyImages: defineTable({                // child table (no unbounded arrays); max 20 per property
  propertyId: v.id("properties"),
  storageId: v.id("_storage"),
  order: v.number(),
  alt: localized,
}).index("by_propertyId_and_order", ["propertyId", "order"]),
```

The public search picks whichever index matches the filters provided and puts the price range in the index range. Results are paginated with `paginationOptsValidator`. No `.collect()` and no `.filter()` on hot paths.

**Error codes** (`ConvexError({ code })`, translated on the client under `Errors.*`): `UNAUTHENTICATED`, `FORBIDDEN`, `ACCOUNT_DISABLED`, `PASSWORD_CHANGE_REQUIRED`, `INVALID_CREDENTIALS`, `PIN_EXPIRED`, `TOO_MANY_ATTEMPTS`, `SETUP_ALREADY_DONE`, `EMAIL_TAKEN`, `ROLE_NOT_FOUND`, `ROLE_IN_USE`, `SYSTEM_ROLE_LOCKED`, `USER_NOT_FOUND`, `PROPERTY_NOT_FOUND`, `PROPERTY_INVALID`, `CITY_NOT_FOUND`.

---

## Permission model

`convex/lib/permissions.ts` exports:
- `PERMISSIONS`, a const array, and `permissionValidator`.
- `requirePermission(ctx, permission)`. It resolves the identity to an auth user, then the `users` row, then the role. It throws `UNAUTHENTICATED`, `ACCOUNT_DISABLED`, `PASSWORD_CHANGE_REQUIRED` or `FORBIDDEN`, and returns `{ user, role }`.
- `requirePropertyEdit(ctx, property)`. It passes with `property.update.any`, or with `property.update.own` when `createdBy === user._id`.

Identity always comes from the server, never from function args. Public functions are the published-property queries, the location lists and setup status.

**Permissions:** `property.create`, `property.update.own`, `property.update.any`, `property.delete`, `property.publish` (publish, unpublish and close), `property.view.any` (see drafts in the back office), `user.view`, `user.manage` (create, edit, disable, reset PIN), `role.manage`, `location.manage`. The last four are additions to your list.

**Proposed default matrix (for your approval):**

| Role | Permissions |
|---|---|
| Super Admin | all (system role, locked) |
| Platform Manager | all `property.*`, `user.view`, `location.manage` |
| Content Manager | `property.create`, `property.update.own`, `property.view.any` |
| Moderator | `property.view.any`, `property.update.any`, `property.publish` |
| Verification Officer | `property.view.any`, `property.publish` |
| Support Agent | `property.view.any`, `user.view` |
| Finance Manager | `property.view.any` (read-only until finance features exist) |

This matrix gives you a review step: Content Managers write drafts, and Verification Officers or Moderators publish them. By default only Super Admin has `user.manage` and `role.manage`.

**Guards:**
- The Super Admin role can't be edited or deleted.
- A role in use can't be deleted.
- The last active Super Admin can't be demoted or disabled.

---

## Auth design

**Interface.** The rest of the app never imports Better Auth directly. It goes through two files:
- `lib/auth/client.ts` defines an `AuthClient` interface (`signIn(email, secret)`, `signOut()`, `changePassword(current, next)`, `useSession()`). The Better Auth version lives in `lib/auth/better-auth-client.ts`.
- `convex/lib/auth.ts` provides `getAuthUser(ctx)` and is the only server file that touches the component.

Adding Google/OAuth or 2FA later means adding a Better Auth plugin or provider and a button. No other code changes.

**Config** (`convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, `app/api/auth/[...all]/route.ts`):
- Email and password are on, with `disableSignUp: true`. Better Auth hashes passwords with scrypt by default.
- Rate limiting is on with database storage. `/sign-in/email` allows 5 attempts per 15 minutes per IP. On top of that, a per-email limit uses `@convex-dev/rate-limiter` in a before-hook and returns `TOO_MANY_ATTEMPTS`.
- `proxy.ts` already skips `/api`.

**Bootstrap.** `/[locale]/setup` is reachable only while the `users` table is empty (a public `setupStatus` query). The `bootstrapSuperAdmin` mutation/action re-checks emptiness inside the transaction, creates the Better Auth user through the admin API and links a Super Admin profile. After that it throws `SETUP_ALREADY_DONE`.

**PIN flow:**
1. **Creating a user (Super Admin).** Generate an 8-digit PIN with `crypto.getRandomValues` and rejection sampling. Store it only as the user's Better Auth credential, which is hashed. Set `mustChangePassword: true` and `pinExpiresAt = now + 72h`. The PIN is returned once in the mutation result and never stored or logged in plaintext.
2. **Signing in.** Use email + PIN on the normal sign-in form. A session-create hook rejects with `PIN_EXPIRED` when `mustChangePassword` is set and the PIN has expired.
3. **Forced password change.** While `mustChangePassword` is set, `requirePermission` throws `PASSWORD_CHANGE_REQUIRED` and the UI sends the user to `/[locale]/change-password`. The new password needs at least 10 characters and must differ from the PIN. On success, clear the flag and `pinExpiresAt`, and revoke the user's other sessions.
4. **Forgotten password.** The Super Admin uses "Reset PIN" (`user.manage`). It generates a new PIN, revokes sessions and runs the same flow again.

**Env:** add `BETTER_AUTH_SECRET`, `SITE_URL` (Convex env) and `NEXT_PUBLIC_CONVEX_SITE_URL` to `.env.example`.

---

## Screens

All routes sit under `/[locale]`, with links through `i18n/navigation.ts`.

| Area | Route | Content |
|---|---|---|
| Public | `/` | Listing grid (cards: image, title, city, price via `useFormatter`, type badge) + filter sidebar (rent/sale, city, min/max price), "load more" pagination, empty state |
| Public | `/properties/[id]` | Gallery, title, address, price, beds/baths/size chips, description in the current locale, contact block (`tel:`, `wa.me`, `mailto:`), metadata/SEO per locale. Drafts or closed properties return 404 |
| Auth | `/setup` | First Super Admin form (name, email, password) |
| Auth | `/sign-in` | Email + password or PIN, translated error codes |
| Auth | `/change-password` | Forced new password |
| Admin | `/admin` | Shell with nav filtered by permissions, user menu, sign out |
| Admin | `/admin/users`, `/admin/users/new`, `/admin/users/[id]` | List; create → "PIN shown once" dialog with copy button; edit role/status, reset PIN |
| Admin | `/admin/roles`, `/admin/roles/new`, `/admin/roles/[id]` | List; bilingual name + permission checkboxes |
| Admin | `/admin/properties`, `/admin/properties/new`, `/admin/properties/[id]` | List (mine / all with `property.view.any`), FR/EN tabbed form, image upload (Convex storage), publish/close/delete actions by permission |

Admin pages are client components that use Convex queries. Security lives in Convex. `proxy.ts` only does an optimistic redirect to `/sign-in` when there's no session cookie, chained after the next-intl middleware.

---

## PRs

### PR 1: `chore/design-tokens`
- Commit `docs/design/inspiration.png`.
- In `app/globals.css`, replace the boilerplate `@theme` with tokens taken from the image:
  - **Colors:** `primary` ≈ `#2B4BEB` (CTA, active tab, checkboxes), `primary-soft` ≈ `#EEF2FF` (secondary button), `surface` `#FFFFFF`, `canvas` ≈ `#F5F6F8` (page background), `ink` ≈ `#111827`, `muted` ≈ `#6B7280`, `border` ≈ `#E5E7EB`, `rating` ≈ `#F5B400`, and badge colors (green, amber, blue). Darken the amber and green text until it passes WCAG AA.
  - **Radius:** `card` 16px, `field` 12px, `pill` full.
  - **Shadow:** soft card shadow.
  - **Type:** a geometric sans (Inter via `next/font/google`, checked against the image) at a 14/16/20/24/32 scale.
  - **Theme:** light only for the MVP, with dark mode noted as later.
- Add a short **Design** section to `CLAUDE.md`: reference the image, the token names, "use tokens, never raw hex" and the AA rule.
- **Tests:** `lib/design/contrast.test.ts` checks the WCAG AA ratio of each text/background token pair, reading the hex values from a `lib/design/tokens.ts` export that the CSS mirrors. Update `home-hero.test.tsx` if the markup changes.

### PR 2: `feat/roles-and-permissions`
- Add `convex/schema.ts` (`roles`, `users`), `convex/lib/permissions.ts`, `convex/roles.ts` (`list`, `get`, `create`, `update`, `remove`; all `role.manage` except `list`/`get`, which need `user.view` or `role.manage`), `convex/seed.ts` (internal, idempotent: the 7 roles with the approved matrix) and `convex/lib/errors.ts`.
- Identity: `ctx.auth.getUserIdentity()` → `users.by_authUserId`. Tests use `t.withIdentity`.
- Add the `Errors.*` keys to both message files.
- **Tests (convex-test):**
  - `requirePermission` cases: allowed, denied, unauthenticated, disabled, must-change-password.
  - Role CRUD: allowed, denied and unauthenticated for each function, plus system role lock, `ROLE_IN_USE` and validator rejection.
  - The seed is idempotent and matches the matrix.

### PR 3: `feat/auth-and-pin-flow`
- Install `better-auth`, `@convex-dev/better-auth` and `@convex-dev/rate-limiter`. Add `convex/convex.config.ts` (mount components), `convex/auth.ts`, `convex/auth.config.ts`, `convex/http.ts`, `app/api/auth/[...all]/route.ts`, `lib/auth/*`, a `ConvexBetterAuthProvider` in the layout, `convex/setup.ts` (`setupStatus`, `bootstrapSuperAdmin`), `convex/lib/pin.ts` and `convex/account.ts` (`me`, `changePassword`).
- Pages: `/setup`, `/sign-in` and `/change-password`, plus redirect logic in `proxy.ts`.
- Read `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and the proxy docs first.
- **Tests:**
  - **Convex:** bootstrap works only once, including when two attempts race; the PIN generator's length and charset; PIN expiry rejects; the change-password flow clears the flag; the rate limiter blocks after N attempts; no plaintext PIN in any stored document.
  - **Component (FR + EN):** the sign-in, setup and change-password forms show validation and translated errors.
  - **Unit:** `proxy.ts` redirects.
  - **E2E:** setup the first admin → sign out → sign in; `/setup` is then unreachable.

### PR 4: `feat/admin-user-management`
- `convex/users.ts` adds `list` (`user.view`), plus `create`, `update`, `setStatus` and `resetPin` (`user.manage`). These cover the PIN return, session revocation and last-Super-Admin guard.
- UI: the admin shell, the user screens and the role screens (the UI for PR 2's functions).
- **Tests:**
  - **Convex:** allowed, denied and unauthenticated for each function; `EMAIL_TAKEN`; reset revokes sessions; the last-Super-Admin guard.
  - **Component (FR + EN):** the PIN dialog shows once and the copy button works; the nav hides items without permission; the role permission checkboxes work.
  - **E2E:** admin creates a user → the user signs in with the PIN → is forced to change password → lands in the admin; then admin resets the PIN and the old password fails.

### PR 5: `feat/property-create-edit`
- Schema: `properties`, `propertyImages`, `provinces`, `cities`. Extend the seed with DRC provinces and main cities (FR/EN names).
- `convex/locations.ts` (public lists) and `convex/properties.ts`: `create`, `update` (own/any), `setStatus` (`property.publish`), `remove` (`property.delete`, also deletes images and storage), `listForAdmin` (paginated, mine or any), `generateUploadUrl`, `addImage`/`removeImage`/`reorderImages`.
- Server-side validation: price > 0, counts ≥ 0, city belongs to province, at least one contact, valid email and phone shapes, both languages non-empty, at most 20 images.
- UI: the admin property list and the FR/EN tabbed form with image upload and status actions.
- **Tests:**
  - **Convex:** a permission case for every function (own vs any, publish, delete, unauthenticated); each validation rule; `PROPERTY_NOT_FOUND`; image cascade delete.
  - **Component (FR + EN):** the form's validation messages and that it shows the price with `useFormatter`.
  - **E2E:** a content manager creates a draft → a verification officer publishes it.

### PR 6: `feat/public-property-pages`
- `convex/publicProperties.ts` (no auth):
  - `search({ listingType?, cityId?, minPriceCents?, maxPriceCents?, paginationOpts })` picks an index, returns only published properties, and resolves image URLs and city names.
  - `get({ id })` returns `null` unless the property is published.
- Replace the boilerplate home page with the listing and filters. The filters live in URL search params, so results are shareable and keyboard-friendly. Add the detail page with `generateMetadata` per locale.
- Remove the Next/Vercel boilerplate and its message keys.
- **Tests:**
  - **Convex:** drafts and closed properties never leak (search and get); each filter combination uses the right index and returns correct results; the price range edges; pagination.
  - **Component (FR + EN):** the card, filters and contact block (correct `tel:`/`wa.me`/`mailto:` hrefs), and that currency is formatted by locale.
  - **E2E:** a visitor without an account filters by city and type, opens a property, sees the contact info, and switches FR ↔ EN on the same property.

---

## Out of scope (follow-ups)
- Location admin UI (`location.manage` already exists)
- Favorites
- Reviews
- Map
- Google/OAuth
- 2FA
- Email delivery of PINs
- Dark mode
- Property kinds (house, apartment, villa)

## Verification
In every PR, run `pnpm lint && pnpm typecheck && pnpm test -- --coverage && pnpm build`. Run `pnpm test:e2e` in PRs 3–6 against a local Convex backend (`pnpm exec convex dev`), with a test-only reset mutation that's off unless `IS_TEST` is set. Check each page by hand in `/fr` and `/en`, with keyboard only, and check contrast with a Lighthouse a11y audit.
