import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Structural guard for the API surface.
 *
 * `withAuth` (lib/api-utils.ts) is the only place that runs the same-origin
 * CSRF check for cookie-authenticated requests. A route that resolves the
 * session itself with a bare `await auth()` gets authentication but skips that
 * check, so a cross-site request carrying the victim's cookie is accepted.
 *
 * Routes that are intentionally unauthenticated (NextAuth handlers, cron jobs
 * guarded by CRON_SECRET, the Stripe webhook, health, version) never call
 * `auth()` at all, so the invariant needs no allowlist: if a route file calls
 * `auth()`, it is doing authorization by hand and is missing the CSRF check.
 */

const API_ROOT = join(process.cwd(), 'app', 'api');

function collectRouteFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...collectRouteFiles(full));
    } else if (entry === 'route.ts') {
      found.push(full);
    }
  }

  return found;
}

describe('API route auth invariants', () => {
  const routeFiles = collectRouteFiles(API_ROOT);

  it('finds the API routes to check', () => {
    expect(routeFiles.length).toBeGreaterThan(50);
  });

  it('no route resolves the session with a bare auth() call', () => {
    const offenders = routeFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // Strip comments so prose mentioning auth() does not trip the check.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return /\bawait\s+auth\s*\(\s*\)/.test(code);
    });

    expect(
      offenders.map((f) => relative(process.cwd(), f)),
      'These routes call auth() directly and therefore skip the same-origin ' +
        'CSRF check in withAuth. Wrap the handler in withAuth instead.'
    ).toEqual([]);
  });

  it('no route imports auth from lib/auth', () => {
    const offenders = routeFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      // `handlers` is the NextAuth request handler export, not session lookup.
      return /import\s*\{[^}]*\bauth\b[^}]*\}\s*from\s*['"]@\/lib\/auth['"]/.test(
        source
      );
    });

    expect(
      offenders.map((f) => relative(process.cwd(), f)),
      'Route files should get the session from withAuth, not by importing auth.'
    ).toEqual([]);
  });
});
