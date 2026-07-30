import { test, expect } from '@playwright/test';

/**
 * E2E: installability and offline behaviour.
 *
 * Requires a PRODUCTION server, because ServiceWorkerRegistration deliberately
 * does nothing outside NODE_ENV=production:
 *   npm run build && npm start
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/pwa.spec.ts --project=chromium
 */

test.describe('PWA manifest and icons', () => {
  test('links a manifest that parses and declares both icon purposes', async ({ page, request }) => {
    await page.goto('/login');

    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(href as string);
    expect(response.ok()).toBe(true);

    const manifest = await response.json();
    expect(manifest.name).toBe('Nametag');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.shortcuts).toHaveLength(3);

    const purposes = manifest.icons.map((icon: { purpose: string }) => icon.purpose);
    expect(purposes).toContain('any');
    expect(purposes).toContain('maskable');
  });

  test('serves every icon the manifest references', async ({ page, request }) => {
    await page.goto('/login');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(href as string)).json();

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const response = await request.get(icon.src);
      expect(response.ok(), icon.src).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('emits the apple touch icon and web app meta tags', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    // Both spellings must be present. Next emits the unprefixed one for
    // appleWebApp.capable, and iOS Safari reads only the apple- prefixed one,
    // which is supplied via metadata.other.
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#121110');
  });

  test('serves the worker uncached so updates can land', async ({ request }) => {
    const response = await request.get('/sw.js');

    expect(response.ok()).toBe(true);
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(response.headers()['service-worker-allowed']).toBe('/');
  });
});

test.describe('Offline behaviour', () => {
  test('the offline page is reachable while logged out', async ({ page }) => {
    await page.goto('/offline');

    await expect(page.getByRole('heading', { name: /offline/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    // No redirect to /login: the worker must be able to serve this pre-auth.
    expect(new URL(page.url()).pathname).toBe('/offline');
  });

  test('registers a service worker and precaches the offline page', async ({ page }) => {
    await page.goto('/login');

    const cached = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        return null;
      }
      const names = await caches.keys();
      const version = names.find((name) => name.startsWith('nametag-static-'));
      if (!version) {
        return null;
      }
      const cache = await caches.open(version);
      const keys = await cache.keys();
      return keys.map((request) => new URL(request.url).pathname);
    });

    expect(cached).not.toBeNull();
    expect(cached).toContain('/offline');
  });

  test('caches nothing beyond the static allowlist', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });

    // Navigate around so the worker has seen real authenticated traffic,
    // including the RSC payload fetches that client-side navigation issues.
    await page.goto('/people');
    await page.goto('/dashboard');

    const unexpected = await page.evaluate(async () => {
      const names = await caches.keys();
      const found: string[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          const { pathname, search } = new URL(request.url);
          const allowed =
            pathname.startsWith('/_next/static/') ||
            pathname.startsWith('/icons/') ||
            pathname === '/logo.svg' ||
            pathname === '/offline';
          if (!allowed) {
            found.push(pathname + search);
          }
        }
      }
      return found;
    });

    // Asserted as an allowlist on purpose. A denylist that only looked for
    // /api/ would miss RSC payloads such as /people?_rsc=abc, which are
    // same-origin GETs outside /api/ that carry full contact data.
    expect(unexpected).toEqual([]);
  });

  test('falls back to the offline page when the network is gone', async ({ page, context }) => {
    await page.goto('/login');
    // Wait for the worker to control the page, otherwise the fallback cannot run.
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.goto('/dashboard');

    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();

    await context.setOffline(false);
  });
});
