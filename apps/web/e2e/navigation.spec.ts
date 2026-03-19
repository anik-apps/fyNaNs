import { test, expect } from '@playwright/test';
import { createAuthenticatedUser } from './helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await createAuthenticatedUser(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  const sidebarLinks = [
    { label: 'Dashboard', url: /\/dashboard/ },
    { label: 'Accounts', url: /\/accounts/ },
    { label: 'Transactions', url: /\/transactions/ },
    { label: 'Budgets', url: /\/budgets/ },
    { label: 'Bills', url: /\/bills/ },
    { label: 'Settings', url: /\/settings/ },
  ];

  for (const link of sidebarLinks) {
    test(`sidebar link "${link.label}" navigates correctly`, async ({ page }) => {
      const sidebarLink = page.locator('aside nav').getByRole('link', { name: link.label });
      await sidebarLink.click();
      await expect(page).toHaveURL(link.url, { timeout: 10000 });
    });
  }

  test('active sidebar link is highlighted', async ({ page }) => {
    // Navigate to settings (a simple client-rendered page that won't error)
    const settingsLink = page.locator('aside nav').getByRole('link', { name: 'Settings' });
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);

    // The active link should have the primary background class
    await expect(settingsLink).toHaveClass(/bg-primary/);

    // The dashboard link should NOT have the active class
    const dashboardLink = page.locator('aside nav').getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).not.toHaveClass(/bg-primary/);
  });
});
