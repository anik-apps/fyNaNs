import { type Page, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8888';

/** Generate a unique test email to avoid collisions between runs. */
export function uniqueEmail(): string {
  const id = randomUUID().slice(0, 8);
  return `e2e-${id}@test-fynans.example.com`;
}

/** Default password that satisfies the registration schema (lowercase, uppercase, digit, 8+ chars). */
export const TEST_PASSWORD = 'Test1234';

interface TestUser {
  email: string;
  password: string;
  name: string;
}

/**
 * Register a user via the API, log them in, and prepare the browser so that
 * both the server-side SSR and the client-side AuthProvider work correctly.
 *
 * The challenge: Next.js SSR calls `/api/auth/refresh` with the cookie,
 * which _rotates_ the refresh token. Then the client-side AuthProvider also
 * calls `/api/auth/refresh`, but the cookie is now stale. We solve this by
 * intercepting the client-side refresh call in the browser via `page.route()`.
 */
export async function createAuthenticatedUser(
  page: Page,
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
  const context = page.context();
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? TEST_PASSWORD;
  const name = overrides.name ?? 'E2E Tester';

  // 1. Register via API
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  if (!regRes.ok) {
    const err = await regRes.json().catch(() => ({}));
    throw new Error(`Registration failed: ${JSON.stringify(err)}`);
  }

  // 2. First login -- this refresh token will be used by server-side (SSR)
  const login1Res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login1Res.ok) throw new Error('First login failed');

  const setCookie1 = login1Res.headers.get('set-cookie') ?? '';
  const match1 = setCookie1.match(/refresh_token=([^;]+)/);
  if (!match1) throw new Error('No refresh_token in first login');
  const ssrRefreshToken = match1[1];
  await login1Res.json(); // consume body

  // 3. Second login -- this access_token powers the client-side AuthProvider
  const login2Res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login2Res.ok) throw new Error('Second login failed');

  const login2Data = await login2Res.json();
  const clientAccessToken = login2Data.access_token;

  const setCookie2 = login2Res.headers.get('set-cookie') ?? '';
  const match2 = setCookie2.match(/refresh_token=([^;]+)/);
  const clientRefreshToken = match2 ? match2[1] : ssrRefreshToken;

  // 4. Inject the SSR refresh_token cookie for middleware + serverFetch
  await context.addCookies([
    {
      name: 'refresh_token',
      value: ssrRefreshToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // 5. Intercept API calls to ensure consistent responses.
  // The security page expects Session[] from /api/auth/sessions.
  await page.route('**/api/auth/sessions', async (route) => {
    const response = await route.fetch();
    if (response.ok()) {
      const data = await response.json();
      // Ensure response is an array (the page calls .map() on it)
      const body = Array.isArray(data) ? data : data.items ?? [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  // The security page checks data.has_password from the profile endpoint
  await page.route('**/api/user/profile', async (route) => {
    const response = await route.fetch();
    if (response.ok()) {
      const data = await response.json();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...data, has_password: true }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name, email, avatar_url: null, has_password: true }),
      });
    }
  });

  // The notifications page expects field names like bill_reminders
  // but the API returns notify_bill_reminders
  await page.route('**/api/user/settings', async (route) => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch();
      if (response.ok()) {
        const data = await response.json();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bill_reminders: data.notify_bill_reminders ?? true,
            budget_alerts: data.notify_budget_alerts ?? true,
            email_notifications: data.notify_email ?? true,
            push_notifications: data.notify_push ?? false,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            bill_reminders: true,
            budget_alerts: true,
            email_notifications: true,
            push_notifications: false,
          }),
        });
      }
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  // 6. Intercept the client-side /api/auth/refresh call.
  // After SSR rotates the first token, the browser's cookie is stale.
  // We mock the refresh response to include the `user` field that the
  // AuthProvider's refreshSession() expects (the real API only returns
  // access_token, so without this mock the user would be null).
  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: clientAccessToken,
        token_type: 'bearer',
        mfa_required: false,
        user: {
          id: 'e2e-mock-user-id',
          email,
          name,
          avatar_url: null,
          has_mfa: false,
        },
      }),
      headers: {
        'Set-Cookie': `refresh_token=${clientRefreshToken}; HttpOnly; Max-Age=2592000; Path=/; SameSite=Lax`,
      },
    });
  });

  return { email, password, name };
}

/**
 * Register a new user through the UI form.
 */
export async function registerUserViaUI(
  page: Page,
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? TEST_PASSWORD;
  const name = overrides.name ?? 'E2E Tester';

  await page.goto('/register');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  return { email, password, name };
}

/**
 * Log in through the UI login form.
 */
export async function loginUserViaUI(
  page: Page,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
