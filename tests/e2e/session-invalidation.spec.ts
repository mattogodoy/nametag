import { test, expect } from '@playwright/test';

/**
 * E2E Test: Session Invalidation After Logout
 *
 * This test verifies that the session invalidation vulnerability is fixed.
 * After logout, old session cookies should no longer be valid.
 */

test.describe('Session Invalidation Security', () => {
  test('should invalidate session after logout even with old cookies', async ({
    browser,
  }) => {
    // Create a new browser context
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 1: Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });

    // Step 2: Verify session is working
    const sessionResponse1 = await page.goto('/api/auth/session');
    expect(sessionResponse1?.status()).toBe(200);
    const sessionData1 = await sessionResponse1?.json();
    expect(sessionData1).toBeTruthy();
    expect(sessionData1.user).toBeTruthy();
    expect(sessionData1.user.email).toBe('demo@nametag.one');

    // Step 3: Save cookies before logout
    const cookiesBeforeLogout = await context.cookies();

    // Step 4: Logout
    await page.goto('/dashboard');

    // Open user menu and click sign out
    await page.click('button:has(svg)');
    await page.waitForSelector('text=/sign out/i', { timeout: 3000 });
    await page.click('text=/sign out/i');

    // Wait for redirect to login
    await expect(page).toHaveURL('/login', { timeout: 5000 });

    // Step 5: Create new context with old cookies
    const newContext = await browser.newContext();
    await newContext.addCookies(cookiesBeforeLogout);
    const newPage = await newContext.newPage();

    // Step 6: Try to access session with old cookies
    const sessionResponse2 = await newPage.goto('/api/auth/session');
    expect(sessionResponse2?.status()).toBe(200);
    const sessionData2 = await sessionResponse2?.json();

    // CRITICAL CHECK: Session should be invalidated
    // The user should be undefined/missing after logout
    expect(sessionData2?.user).toBeUndefined();

    // Step 7: Verify dashboard redirects to login (not accessible)
    await newPage.goto('/dashboard');
    await expect(newPage).toHaveURL('/login', { timeout: 5000 });

    // Cleanup
    await newPage.close();
    await newContext.close();
    await page.close();
    await context.close();
  });

  test('should generate unique jti for each login session', async ({
    browser,
  }) => {
    // This test verifies that each login gets a unique token ID
    // Login twice and verify sessions are different

    // First login
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    await page1.goto('/login');
    await page1.fill('input[name="email"]', 'demo@nametag.one');
    await page1.fill('input[name="password"]', 'password123');
    await page1.click('button[type="submit"]');
    await expect(page1).toHaveURL('/dashboard', { timeout: 5000 });

    const cookies1 = await context1.cookies();
    const sessionCookie1 = cookies1.find(
      (c) =>
        c.name.includes('session-token') || c.name.includes('authjs.session-token')
    );

    // Second login (different context)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    await page2.goto('/login');
    await page2.fill('input[name="email"]', 'demo@nametag.one');
    await page2.fill('input[name="password"]', 'password123');
    await page2.click('button[type="submit"]');
    await expect(page2).toHaveURL('/dashboard', { timeout: 5000 });

    const cookies2 = await context2.cookies();
    const sessionCookie2 = cookies2.find(
      (c) =>
        c.name.includes('session-token') || c.name.includes('authjs.session-token')
    );

    // Tokens should be different (different jti)
    expect(sessionCookie1?.value).toBeTruthy();
    expect(sessionCookie2?.value).toBeTruthy();
    expect(sessionCookie1?.value).not.toBe(sessionCookie2?.value);

    // Cleanup
    await page1.close();
    await page2.close();
    await context1.close();
    await context2.close();
  });
});
