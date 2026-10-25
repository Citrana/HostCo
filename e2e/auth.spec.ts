import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";

/** Creates a user with a one-time PIN on the test deployment (IS_TEST only). */
function createPinUser(email: string): string {
  const output = execFileSync(
    "pnpm",
    ["exec", "convex", "run", "testing:createPinUser", JSON.stringify({ email })],
    { encoding: "utf8" },
  );
  return (JSON.parse(output) as { pin: string }).pin;
}

// One shared backend: the setup only works once, so these run in order.
test.describe.configure({ mode: "serial" });

const admin = {
  name: "Amani Kabila",
  // Unique per run, so the per-email sign-in limit never carries over.
  email: `admin-${Date.now()}@example.com`,
  password: "a-long-secret-123",
};

test("the first admin sets up the platform, signs out and signs back in", async ({ page }) => {
  await page.goto("/fr/setup");
  await page.getByLabel("Nom complet").fill(admin.name);
  await page.getByLabel("Adresse e-mail").fill(admin.email);
  await page.getByLabel("Mot de passe").fill(admin.password);
  await page.getByRole("button", { name: "Créer le compte" }).click();

  await expect(page).toHaveURL(/\/fr\/admin$/);
  await expect(page.getByRole("heading", { name: `Bienvenue, ${admin.name}` })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/fr\/sign-in$/);

  await page.getByLabel("Adresse e-mail").fill(admin.email);
  await page.getByLabel("Mot de passe ou code PIN").fill(admin.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/fr\/admin$/);
  await expect(page.getByRole("heading", { name: `Bienvenue, ${admin.name}` })).toBeVisible();
});

test("setup can't be reached once an admin exists", async ({ page }) => {
  await page.goto("/en/setup");

  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in to the team area" })).toBeVisible();
});

test("a wrong password shows a translated error", async ({ page }) => {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(admin.email);
  await page.getByLabel("Password or PIN").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  // Next's route announcer is also an alert, so match ours by its text.
  await expect(
    page.getByRole("alert").filter({ hasText: "Incorrect email or password." }),
  ).toBeVisible();
});

test("a visitor without a session is sent from the team area to sign-in", async ({ page }) => {
  await page.goto("/en/admin");

  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("a new user replaces their PIN with a password, and the PIN stops working", async ({
  page,
}) => {
  const email = `pin-${Date.now()}@example.com`;
  const pin = createPinUser(email);
  const password = "my-own-password-1";

  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password or PIN").fill(pin);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/en\/change-password$/);
  await page.getByLabel("Current password or PIN").fill(pin);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm the new password").fill(password);
  await page.getByRole("button", { name: "Save the password" }).click();

  await expect(page).toHaveURL(/\/en\/admin$/);
  await expect(page.getByRole("heading", { name: "Welcome, PIN User" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/en\/sign-in$/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password or PIN").fill(pin);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Incorrect email or password." }),
  ).toBeVisible();
});
