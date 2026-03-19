import { test, expect } from '@playwright/test';
import { createAuthenticatedUser } from './helpers';

test.describe('Dashboard page', () => {
  test.beforeEach(async ({ page }) => {
    await createAuthenticatedUser(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('renders the dashboard heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Dashboard' }),
    ).toBeVisible({ timeout: 15000 });
  });

  test('net worth card renders', async ({ page }) => {
    await expect(
      page.getByText(/net worth/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('accounts summary section exists', async ({ page }) => {
    await expect(
      page.getByText(/accounts/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('recent transactions section exists', async ({ page }) => {
    await expect(
      page.getByText(/recent transactions/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('budget bars section exists', async ({ page }) => {
    await expect(
      page.getByText(/budget/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });

  test('upcoming bills section exists', async ({ page }) => {
    await expect(
      page.getByText(/upcoming bills/i).first(),
    ).toBeVisible({ timeout: 15000 });
  });
});
