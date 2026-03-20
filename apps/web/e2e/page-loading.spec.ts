import { test, expect } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888";

function uniqueEmail() {
  return `pages-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function loginViaForm(page: any, email: string, password: string) {
  await page.goto("/login");
  await page.fill('[id="email"]', email);
  await page.fill('[id="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function navigateAuthenticated(page: any, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

test.describe("All pages load without errors", () => {
  let email: string;
  const password = "PageTest123!";

  test.beforeAll(async () => {
    email = uniqueEmail();
    const resp = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Page Test User" }),
    });
    if (!resp.ok) {
      throw new Error(`Setup failed: registration returned ${resp.status}`);
    }
  });

  function setupErrorCollection(page: any) {
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => {
      errors.push(error.message);
    });
    return errors;
  }

  test("dashboard loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);
    expect(errors).toEqual([]);
  });

  test("accounts page loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/accounts");
    await expect(page).toHaveURL(/\/accounts/);
    expect(errors).toEqual([]);
  });

  test("transactions page loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/transactions");
    await expect(page).toHaveURL(/\/transactions/);
    expect(errors).toEqual([]);
  });

  test("budgets page loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/budgets");
    await expect(page).toHaveURL(/\/budgets/);
    expect(errors).toEqual([]);
  });

  test("bills page loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/bills");
    await expect(page).toHaveURL(/\/bills/);
    expect(errors).toEqual([]);
  });

  test("settings page loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/settings");
    await expect(page).toHaveURL(/\/settings/);
    expect(errors).toEqual([]);
  });

  test("settings/profile loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/settings/profile");
    await expect(page).toHaveURL(/\/settings\/profile/);
    expect(errors).toEqual([]);
  });

  test("settings/security loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/settings/security");
    await expect(page).toHaveURL(/\/settings\/security/);
    expect(errors).toEqual([]);
  });

  test("settings/notifications loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/settings/notifications");
    await expect(page).toHaveURL(/\/settings\/notifications/);
    expect(errors).toEqual([]);
  });

  test("notifications page loads without errors", async ({ page }) => {
    const errors = setupErrorCollection(page);
    await loginViaForm(page, email, password);
    await navigateAuthenticated(page, "/notifications");
    await expect(page).toHaveURL(/\/notifications/);
    expect(errors).toEqual([]);
  });
});
