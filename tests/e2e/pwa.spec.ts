import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * The demo account used below persists a `language` preference in the
 * database (self-hosted, shared across manual and automated testing), so
 * which locale actually renders after login is not something this suite
 * controls or should assume. Building the offline copy check from every
 * locale file, rather than hardcoding the English strings, keeps the
 * assertion correct no matter which language the account is currently set to.
 */
function localizedOfflineCopy(): { titles: string[]; retries: string[] } {
  const localesDir = path.join(__dirname, '../../locales');
  const titles: string[] = [];
  const retries: string[] = [];
  for (const file of fs.readdirSync(localesDir)) {
    if (!file.endsWith('.json')) continue;
    const messages = JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf-8'));
    const offline = messages?.pwa?.offline;
    if (offline?.title) titles.push(offline.title);
    if (offline?.retry) retries.push(offline.retry);
  }
  return { titles, retries };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function anyOf(values: string[]): RegExp {
  return new RegExp(values.map(escapeRegExp).join('|'));
}

/**
 * E2E: installability and offline behaviour.
 *
 * Requires a PRODUCTION server, because ServiceWorkerRegistration deliberately
 * does nothing outside NODE_ENV=production:
 *   npm run build && npm start
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/pwa.spec.ts --project=chromium
 */

/*
 * components/LocaleSync.tsx reloads the page roughly 30 to 50ms after first load
 * whenever the NEXT_LOCALE cookie disagrees with the server-resolved locale,
 * which on a fresh browser context means EVERY first navigation. That reload
 * tears down any page.evaluate context and makes the service worker assertions
 * below race against it. Seeding the cookie makes LocaleSync short-circuit,
 * which is also what a returning user looks like.
 *
 * This is pre-existing app behaviour, unrelated to the PWA work.
 */
test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([
    { name: 'NEXT_LOCALE', value: 'en', url: baseURL ?? 'http://localhost:3000' },
  ]);
});

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

  test('emits the apple touch icon and web app meta tags', async ({ page, request }) => {
    await page.goto('/login');

    const appleTouchIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchIcon).toHaveCount(1);

    // Asserting the link exists is not enough: a typo in the layout's path
    // would still pass that check. Fetch it, like the manifest icons already are.
    const href = await appleTouchIcon.getAttribute('href');
    expect(href).toBeTruthy();
    const response = await request.get(href as string);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');

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
    await expect(page.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/');
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
    // Wait for hydration before touching the form. Without this, under parallel
    // load the click can land before React attaches and the form submits
    // natively as a GET, which never reaches /dashboard.
    await page.waitForLoadState('networkidle');
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

    await expect(page.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/');

    await context.setOffline(false);
  });

  test('shows the offline page, not the generic error, when a soft navigation fails', async ({
    page,
    context,
  }) => {
    // page.goto is a HARD navigation and never exercises the code path this
    // test is guarding: in a running app, in-app navigation is a Next.js SOFT
    // navigation that fetches an RSC payload rather than a document. The
    // service worker deliberately never caches those (they carry contact
    // data), so offline they fail and the nearest error.tsx renders. Only a
    // real in-app click reproduces that.
    //
    // Next.js's <Link> auto-prefetches routes that sit in the viewport (the
    // top nav is always visible), which would otherwise satisfy the later
    // click from an in-memory router cache instead of hitting the network,
    // masking the exact bug this test exists to catch. Blocking requests
    // carrying the `next-router-prefetch` header (set only on those
    // speculative fetches, never on the real navigation triggered by a
    // click) forces every navigation below to go to the network for real.
    await page.route('**/*', async (route) => {
      if (route.request().headers()['next-router-prefetch']) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.fill('input[name="email"]', 'demo@nametag.one');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });

    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);

    // The dashboard's top nav links to /people; this is a normal in-app
    // <Link>, so clicking it triggers a client-side soft navigation. Matched
    // by href rather than accessible name because the nav label is
    // translated and the demo account's locale is not something this test
    // controls (see localizedOfflineCopy above).
    await page.locator('a[href="/people"]').first().click();

    const { titles, retries } = localizedOfflineCopy();
    await expect(page.getByText(anyOf(titles))).toBeVisible();
    await expect(page.getByRole('link', { name: anyOf(retries) })).toHaveAttribute('href', '/');
    // The nearest boundary for a failed /people navigation is
    // app/people/error.tsx, whose fallback copy is hardcoded English
    // (pre-existing, out of scope) regardless of locale, so this check is
    // locale-independent.
    await expect(page.getByText(/failed to load people/i)).not.toBeVisible();

    await context.setOffline(false);
  });
});
