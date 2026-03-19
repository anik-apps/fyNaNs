import { test, expect } from '@playwright/test';
import { createAuthenticatedUser } from './helpers';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await createAuthenticatedUser(page);
  });

  test('settings page shows profile, security, and notifications links', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Profile')).toBeVisible();
    await expect(page.getByText('Security')).toBeVisible();
    await expect(page.getByText('Notifications')).toBeVisible();
  });

  test('settings/profile shows personal information section', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'Profile' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Personal Information')).toBeVisible();
    await expect(page.getByLabel('Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('settings/security shows 2FA section', async ({ page }) => {
    await page.goto('/settings/security');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'Security' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Two-Factor Authentication')).toBeVisible();
  });

  test('settings/notifications shows preference toggles', async ({ page }) => {
    await page.goto('/settings/notifications');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'Notification Settings' }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Bill Reminders')).toBeVisible();
    await expect(page.getByText('Budget Alerts')).toBeVisible();
    await expect(page.getByText('Email Notifications')).toBeVisible();
    await expect(page.getByText('Push Notifications', { exact: true })).toBeVisible();
  });
});
