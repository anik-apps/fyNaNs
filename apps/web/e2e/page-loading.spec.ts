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
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

// Helper: assert no JS errors on page
async function assertNoErrors(page: any) {
  await expect(page.locator("text=TypeError")).not.toBeVisible();
  await expect(page.locator("text=Cannot read properties")).not.toBeVisible();
  await expect(page.locator("text=is not defined")).not.toBeVisible();
}

test.describe("All pages load without errors", () => {
  let email: string;
  const password = "PageTest123!";

  test.beforeAll(async () => {
    email = uniqueEmail();
    await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Page Test User" }),
    });
  });

  test("dashboard loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    // Wait for dashboard content to load (skeleton disappears)
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    // Should be on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("accounts page loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/accounts");
    await expect(page).toHaveURL(/\/accounts/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("transactions page loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/transactions/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("budgets page loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/budgets");
    await expect(page).toHaveURL(/\/budgets/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("bills page loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/bills");
    await expect(page).toHaveURL(/\/bills/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("settings page loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("settings/profile loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/settings\/profile/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("settings/security loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/settings/security");
    await expect(page).toHaveURL(/\/settings\/security/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("settings/notifications loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/settings/notifications");
    await expect(page).toHaveURL(/\/settings\/notifications/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });

  test("notifications page loads without errors", async ({ page }) => {
    await loginViaForm(page, email, password);
    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/notifications/);
    await page.waitForTimeout(2000);
    await assertNoErrors(page);
  });
});
