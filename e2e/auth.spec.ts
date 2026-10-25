import { expect, test, type Page } from "@playwright/test";

/** Signs out through the account menu in the admin header. */
async function signOut(page: Page, name: string, label: "Se déconnecter" | "Sign out") {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("button", { name: label }).click();
}

async function signIn(page: Page, email: string, secret: string) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password or PIN").fill(secret);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const PIN_PATTERN = /\b\d{8}\b/;

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

  await signOut(page, admin.name, "Se déconnecter");
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

test("an admin creates a user who replaces the PIN, then resets it", async ({ browser }) => {
  const adminPage = await (await browser.newContext()).newPage();
  const userPage = await (await browser.newContext()).newPage();
  const user = { name: "Grace Mbuyi", email: `grace-${Date.now()}@example.com` };
  const password = "my-own-password-1";

  await signIn(adminPage, admin.email, admin.password);
  await expect(adminPage).toHaveURL(/\/en\/admin$/);
  await adminPage.getByRole("navigation").getByRole("link", { name: "Users" }).click();
  await adminPage.getByRole("link", { name: "New user" }).click();
  await adminPage.getByLabel("Full name").fill(user.name);
  await adminPage.getByLabel("Email address").fill(user.email);
  await adminPage.getByLabel("Role").selectOption({ label: "Moderator" });
  await adminPage.getByRole("button", { name: "Create the user" }).click();

  const pinDialog = adminPage.getByRole("alertdialog", { name: "One-time PIN" });
  const pin = (await pinDialog.textContent())?.match(PIN_PATTERN)?.[0];
  expect(pin).toBeDefined();
  await pinDialog.getByRole("button", { name: "I’ve passed on the PIN" }).click();
  await expect(adminPage.getByRole("heading", { level: 1, name: user.name })).toBeVisible();

  // The new user is sent to replace the PIN, then lands in the team area.
  await signIn(userPage, user.email, pin!);
  await expect(userPage).toHaveURL(/\/en\/change-password$/);
  await userPage.getByLabel("Current password or PIN").fill(pin!);
  await userPage.getByLabel("New password", { exact: true }).fill(password);
  await userPage.getByLabel("Confirm the new password").fill(password);
  await userPage.getByRole("button", { name: "Save the password" }).click();
  await expect(userPage).toHaveURL(/\/en\/admin$/);
  await expect(userPage.getByRole("heading", { name: `Welcome, ${user.name}` })).toBeVisible();

  // A forgotten password: the admin issues a new PIN and the old password stops working.
  await adminPage.getByRole("button", { name: "Generate a new PIN" }).click();
  await adminPage.getByRole("button", { name: "Confirm and generate" }).click();
  const newPin = (await pinDialog.textContent())?.match(PIN_PATTERN)?.[0];
  expect(newPin).toBeDefined();
  expect(newPin).not.toBe(pin);
  await pinDialog.getByRole("button", { name: "I’ve passed on the PIN" }).click();

  await userPage.context().clearCookies();
  await signIn(userPage, user.email, password);
  await expect(
    userPage.getByRole("alert").filter({ hasText: "Incorrect email or password." }),
  ).toBeVisible();
  await signIn(userPage, user.email, newPin!);
  await expect(userPage).toHaveURL(/\/en\/change-password$/);
});
