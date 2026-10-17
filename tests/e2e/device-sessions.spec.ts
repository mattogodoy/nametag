import { test, expect, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

/**
 * E2E Test: Signed-in devices and sign-out-everywhere on password change.
 *
 * The demo user's credentials are the seeded ones used by every other e2e
 * spec. The form cannot restore "password123" (it fails the strength rules),
 * so the original hash is written back through the database afterwards.
 */
const TEST_EMAIL = 'demo@nametag.one';
const TEST_PASSWORD = 'password123';
// Unique per run so leftovers from an aborted run never collide.
const DEVICE_NAME = `E2E Phone ${Date.now()}`;
const CHANGED_PASSWORD = 'ChangedPassword123!';

function connectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  const password = DB_PASSWORD ? `:${DB_PASSWORD}` : '';
  return `postgresql://${DB_USER}${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

let originalLanguage: string | null = null;

// A bare client, not lib/prisma: the soft-delete extension and env
// validation are not needed here and the spec runs outside the app.
function createClient(): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });
}

// Login applies the user's saved language, so pin it to English for the
// label assertions and put the previous value back afterwards.
async function useEnglish(): Promise<void> {
  const db = createClient();
  try {
    const user = await db.user.findUnique({
      where: { email: TEST_EMAIL },
      select: { language: true },
    });
    originalLanguage = user?.language ?? null;
    await db.user.update({ where: { email: TEST_EMAIL }, data: { language: 'en' } });
  } finally {
    await db.$disconnect();
  }
}

async function restoreUser(): Promise<void> {
  const db = createClient();
  try {
    const password = await bcrypt.hash(TEST_PASSWORD, 10);
    await db.user.update({
      where: { email: TEST_EMAIL },
      data: { password, language: originalLanguage ?? 'en' },
    });
  } finally {
    await db.$disconnect();
  }
}

async function signIn(page: Page, password: string): Promise<void> {
  await page.goto('/login');
  // Wait for hydration so the submit is handled by React, not a native GET.
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', TEST_EMAIL);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
}

// The page language follows Accept-Language, so pin it for the English labels.
test.use({ locale: 'en-US' });
test.describe.configure({ mode: 'serial' });

test.describe('Signed-in devices', () => {
  test.beforeAll(async () => {
    await useEnglish();
  });

  test.afterAll(async () => {
    await restoreUser();
  });

  test('lists, revokes, and signs out everywhere on password change', async ({
    browser,
    page,
    request,
  }) => {
    // 1. Sign in in the browser.
    await signIn(page, TEST_PASSWORD);

    // 2. Create a native app session through the API.
    const login = await request.post('/api/auth/native/login', {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        device: { name: DEVICE_NAME, platform: 'IOS', appVersion: '1.0.0' },
      },
    });
    expect(login.status()).toBe(200);
    const { accessToken } = await login.json();

    // 3. The device is listed and can be signed out.
    await page.goto('/settings/security');
    await expect(page.getByText(DEVICE_NAME)).toBeVisible();
    await page.getByRole('button', { name: `Sign out: ${DEVICE_NAME}` }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByText(DEVICE_NAME)).toHaveCount(0);

    // 4. The revoked app token no longer works.
    const people = await request.get('/api/people', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(people.status()).toBe(401);

    // A second browser signed in with the old password, before the change.
    const otherContext = await browser.newContext({ locale: 'en-US' });
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, TEST_PASSWORD);

    // 5. Change the password in the first browser; it stays signed in.
    await page.fill('input[id="currentPassword"]', TEST_PASSWORD);
    await page.fill('input[id="newPassword"]', CHANGED_PASSWORD);
    await page.fill('input[id="confirmPassword"]', CHANGED_PASSWORD);
    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.getByText(/changed successfully/i)).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page).toHaveURL(/\/settings\/security/);

    // 6. The other browser is signed out. Two requests in a row: the second
    // one covers a session cookie that NextAuth re-encoded after the first.
    await otherPage.goto('/settings/security');
    await expect(otherPage).toHaveURL(/\/login/, { timeout: 10000 });
    await otherPage.goto('/settings/security');
    await expect(otherPage).toHaveURL(/\/login/, { timeout: 10000 });
    await otherContext.close();
  });
});
