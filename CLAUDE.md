@AGENTS.md

# hostco: rules for AI agents

hostco is a real estate platform. Stack: Next.js App Router, React, TypeScript strict, Tailwind, Convex, next-intl, pnpm.
These rules are mandatory. If a request conflicts with them, say so before you act.

## Git flow

- `main` is production and `develop` is integration. Never commit directly to either one.
- Every other branch is `<type>/<kebab-case-description>`, where type is one of `feat|fix|refactor|chore|docs|test`. Example: `feat/property-listing-form`.
- Branch off `develop` and open PRs into `develop`. Release by opening a PR from `develop` to `main`.
- Commits are small: one logical change each.
- A commit message is one lowercase imperative line in plain words, with no type prefix and no trailing period.
  - Good: `let agents publish a property listing`, `show prices in dollars on the property page`
  - Bad: `feat: Add listing.`, `fix stuff`, `WIP`
- PR titles use the same style. Fill the PR body from `.github/PULL_REQUEST_TEMPLATE.md`, with every section completed.
- Husky's pre-commit hook rejects bad branch names and runs `pnpm test`. Never bypass it with `--no-verify`.

## Testing

- Every feature, fix or behavior change ships with tests in the same change. No code without tests.
- For bug fixes, write the failing regression test first, then fix it.
- Tools:
  - Vitest + React Testing Library: unit and component tests (`*.test.ts(x)` next to the code)
  - convex-test: Convex functions (`convex/**/*.test.ts`)
  - Playwright: key user flows (`e2e/`)
- Coverage on new code must be 80% or higher (`pnpm test -- --coverage`).
- Before saying a task is done, run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, and report the real results. Also run `pnpm test:e2e` when a user flow changed. Never claim something passes without running it.

## Languages: French by default, English second

- All user-facing text exists in French and English. That covers UI, metadata/SEO, errors, alt text, aria-labels and toasts.
- No hardcoded user-facing strings. Use next-intl (`useTranslations` / `getTranslations`).
- URLs carry a locale prefix: `/fr/...` and `/en/...`. Link with the helpers in `i18n/navigation.ts`, not `next/link`.
- Every new key goes into both `messages/fr.json` and `messages/en.json` in the same change. `messages/messages.test.ts` fails if the two files' keys differ.
- Write natural French, never a word-for-word translation: correct accents, typographic apostrophes (`’`), and a non-breaking space before `: ; ! ?` (U+202F before `; ! ?`, U+00A0 before `:`).
- Format dates, numbers and currency with Intl (next-intl's `useFormatter` / `getFormatter`). Never format them by hand.
- Tests cover both locales for anything that shows text.
- Convex returns error codes (e.g. `PROPERTY_NOT_FOUND`), never display text. The client translates them through `messages/*.json`.
- Property title and description are stored in both languages (e.g. `title: { fr, en }`).

## Convex, auth, permissions

- Every Convex function validates its args with `v` validators. No exceptions.
- Never edit `convex/_generated`.
- Every query and mutation that is not public calls the shared `requirePermission()` helper (`convex/lib/permissions.ts`). Create the helper, with tests, alongside the first non-public function. Never rely on the UI for security.
- Never store plaintext passwords or PINs. Secrets live only in env vars, and `.env.example` stays current.
- Every permission rule and auth flow has tests: allowed, denied and unauthenticated cases.
- Currency is USD only.
- Published properties are public and need no login. Everything else is private by default.

## General

- pnpm only. Never use npm or yarn.
- Node 22.22.2 or newer (`.nvmrc`; run `nvm use`). Vitest and jsdom don't run on Node 20.
- TypeScript strict. No `any` unless a comment explains why.
- Read the relevant guide in `node_modules/next/dist/docs/` before using any Next.js API. Next 16 differs from your training data (e.g. `proxy.ts` instead of `middleware.ts`, `next/root-params`, Cache Components).
- Keep changes small and focused, and follow the patterns already in the codebase.
- Accessibility: semantic HTML, full keyboard navigation, WCAG AA contrast.
