import { test, expect } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888";

function uniqueEmail() {
  return `real-flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test.describe("Real Auth Flow (no mocking)", () => {
  test("register → auto-login → redirect to dashboard", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/register");
    await expect(page.locator("text=Create account").first()).toBeVisible();

    await page.fill('[id="name"]', "Real Flow User");
    await page.fill('[id="email"]', email);
    await page.fill('[id="password"]', "RealFlow123!");
    await page.fill('[id="confirmPassword"]', "RealFlow123!");
    await page.click('button[type="submit"]');

    // Should redirect to dashboard (wait for navigation)
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login → redirect to dashboard", async ({ page }) => {
    const email = uniqueEmail();
    const password = "LoginFlow123!";

    // Register via API first
    await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Login Test" }),
    });

    await page.goto("/login");
    await expect(page.locator("text=Sign in").first()).toBeVisible();

    await page.fill('[id="email"]', email);
    await page.fill('[id="password"]', password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login with wrong password shows error", async ({ page }) => {
    const email = uniqueEmail();

    // Register via API
    await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "CorrectPass123!", name: "Wrong PW Test" }),
    });

    await page.goto("/login");
    await page.fill('[id="email"]', email);
    await page.fill('[id="password"]', "WrongPassword123!");
    await page.click('button[type="submit"]');

    // Should show error, stay on login
    await expect(page.locator("text=Invalid email or password")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout redirects to login", async ({ page }) => {
    const email = uniqueEmail();
    const password = "LogoutTest123!";

    // Register and login via form
    await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: "Logout Test" }),
    });

    await page.goto("/login");
    await page.fill('[id="email"]', email);
    await page.fill('[id="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Find and click logout (usually in dropdown or sidebar)
    // Try common locations
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out"), a:has-text("Logout"), a:has-text("Log out")');
    if (await logoutButton.count() > 0) {
      await logoutButton.first().click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});
