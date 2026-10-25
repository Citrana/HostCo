import { render } from "@testing-library/react";
import { getFunctionName, type FunctionReference } from "convex/server";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import { vi, type Mock } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { PERMISSIONS } from "@/convex/lib/permissions";
import { AuthClientContext, type AuthClient } from "@/lib/auth/client";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { fakeAuthClient, type Locale } from "../auth/test-utils";
import { AdminSessionContext, type AdminMe } from "./admin-session";

export { LOCALES } from "../auth/test-utils";

export function adminMe(overrides: Partial<AdminMe> = {}): AdminMe {
  return {
    id: "users_me" as Id<"users">,
    roleId: "roles_me" as Id<"roles">,
    name: "Amani Kabila",
    email: "amani@example.com",
    roleName: { fr: "Super administrateur", en: "Super Admin" },
    mustChangePassword: false,
    // A Super Admin by default: `account.me` gives the system role everything.
    permissions: [...PERMISSIONS],
    ...overrides,
  };
}

/** Renders inside the providers as a wrapper, so `rerender` keeps them. */
export function renderAdmin(
  ui: ReactElement,
  {
    locale = "fr",
    me = adminMe(),
    auth = fakeAuthClient(),
  }: { locale?: Locale; me?: AdminMe; auth?: AuthClient } = {},
) {
  const messages = locale === "fr" ? fr : en;
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages}>
        <AuthClientContext value={auth}>
          <AdminSessionContext value={me}>{children}</AdminSessionContext>
        </AuthClientContext>
      </NextIntlClientProvider>
    );
  }
  return { ...render(ui, { wrapper: Wrapper }), auth, messages };
}

/** A `useQuery` stand-in that answers by function name, e.g. `"users:list"`. */
export function answerQueries(results: Record<string, unknown>) {
  return (query: FunctionReference<"query">, args: unknown) =>
    args === "skip" ? undefined : results[getFunctionName(query)];
}

const mutationFns = new Map<string, Mock>();

/** `useMutation` stand-ins, one mock per function name, e.g. `"users:create"`. */
export const mutations = {
  get(name: string): Mock {
    let fn = mutationFns.get(name);
    if (fn === undefined) {
      fn = vi.fn();
      mutationFns.set(name, fn);
    }
    return fn;
  },
  reset() {
    mutationFns.clear();
  },
  useMutation: (mutation: FunctionReference<"mutation">) =>
    mutations.get(getFunctionName(mutation)),
};

/** The parts of `@/i18n/navigation` the admin screens use. */
export const navigation = {
  pathname: "/admin",
  push: vi.fn(),
  replace: vi.fn(),
};

function Link({ href, children, ...rest }: { href: string; children: ReactNode }) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export const navigationMock = {
  Link,
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
};

