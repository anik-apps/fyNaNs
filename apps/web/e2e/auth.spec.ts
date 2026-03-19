import { test, expect } from '@playwright/test';
import {
  uniqueEmail,
  TEST_PASSWORD,
  createAuthenticatedUser,
  registerUserViaUI,
  loginUserViaUI,
} from './helpers';

test.describe('Auth flows', () => {
  test('login page renders the sign-in form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('register form submits and shows no client-side validation errors', async ({ page }) => {
    const user = await registerUserViaUI(page);

    // The form should submit without client-side validation errors.
    await page.waitForTimeout(2000);
    await expect(
      page.locator('form').getByText('is required'),
    ).not.toBeVisible();

    expect(user.email).toContain('@test-fynans.example.com');
  });

  test('login with valid credentials sets a session cookie', async ({ page }) => {
    // Register a user via API, then test the login UI
    const user = await createAuthenticatedUser(page);

    // Clear cookies and route interceptions for a fresh login test
    await page.context().clearCookies();
    await page.unrouteAll();
    await page.goto('/login');

    // Fill in the form and submit
    await loginUserViaUI(page, user.email, user.password);

    // The login API sets a refresh_token cookie. Wait for the request to complete.
    await page.waitForTimeout(3000);

    const cookies = await page.context().cookies();
    const refreshCookie = cookies.find((c) => c.name === 'refresh_token');
    expect(refreshCookie).toBeDefined();
  });

  test('login with wrong password shows error message', async ({ page }) => {
    // Register a user via API first
    const user = await createAuthenticatedUser(page);

    // Clear cookies and route interceptions
    await page.context().clearCookies();
    await page.unrouteAll();
    await page.goto('/login');

    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('WrongPassword99');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should show an error, not redirect
    await expect(
      page.locator('[class*="destructive"]').first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout redirects to login page', async ({ page }) => {
    await createAuthenticatedUser(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Remove the refresh route intercept so the logout actually takes effect
    // (otherwise the AuthProvider would immediately re-authenticate)
    await page.unrouteAll();

    // The avatar button is a round button in the header containing initials
    const avatarButton = page.locator('header button.rounded-full');
    await avatarButton.click();

    // Click the "Sign out" menu item
    await page.getByText('Sign out').click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('visiting a protected page without auth redirects to login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
