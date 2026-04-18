import { test, expect } from '@playwright/test';
import { createAuthenticatedUser } from './helpers';

test.setTimeout(60000);

const viewports = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
};

// Public pages — no auth, one test per page captures all viewports
const publicPages = [
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
  { name: 'forgot-password', path: '/forgot-password' },
];

for (const pg of publicPages) {
  test(`visual: ${pg.name}`, async ({ page }) => {
    await page.goto(pg.path);
    await page.waitForLoadState('networkidle');

    for (const [vpName, vpSize] of Object.entries(viewports)) {
      await page.setViewportSize(vpSize);
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`${pg.name}-${vpName}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    }
  });
}

// Auth pages — single user registration, all pages and viewports
const authPages = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'accounts', path: '/accounts' },
  { name: 'transactions', path: '/transactions' },
  { name: 'budgets', path: '/budgets' },
  { name: 'bills', path: '/bills' },
  { name: 'goals', path: '/goals' },
  { name: 'settings', path: '/settings' },
  { name: 'settings-profile', path: '/settings/profile' },
  { name: 'settings-security', path: '/settings/security' },
  { name: 'settings-notifications', path: '/settings/notifications' },
];

test('visual: auth pages', async ({ page }) => {
  await createAuthenticatedUser(page);

  for (const pg of authPages) {
    await page.goto(pg.path);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    for (const [vpName, vpSize] of Object.entries(viewports)) {
      await page.setViewportSize(vpSize);
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot(`${pg.name}-${vpName}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
      });
    }
  }
});
