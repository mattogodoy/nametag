import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { generateOpenAPISpec } from '@/lib/openapi';

/**
 * Cross-checks the OpenAPI spec against the routes that actually exist.
 *
 * The existing spec test hand-lists paths it expects to find, which cannot
 * catch a route added without a spec entry. These tests derive the expectation
 * from the filesystem and from each route's own auth options, so the rule in
 * CLAUDE.md ("every API endpoint change must be reflected in the spec") fails
 * the build instead of relying on reviewer memory.
 */

const API_ROOT = join(process.cwd(), 'app', 'api');

/**
 * Routes deliberately absent from the public spec. Each needs a reason: this
 * list is an escape hatch for endpoints that are not part of the documented
 * API, not a parking spot for undocumented work.
 */
const INTENTIONALLY_UNDOCUMENTED = new Map([
  ['/api/auth/{nextauth}', 'NextAuth.js internal handler; its routes are framework-defined'],
  ['/api/{notfound}', 'Catch-all that returns 404 for unknown API paths'],
  [
    '/api/notifications/email',
    'Web push feature route; OpenAPI spec entry lands in the follow-up commit that documents the whole feature',
  ],
  [
    '/api/notifications/push/public-key',
    'Web push feature route; OpenAPI spec entry lands in the follow-up commit that documents the whole feature',
  ],
  [
    '/api/notifications/push/subscribe',
    'Web push feature route; OpenAPI spec entry lands in the follow-up commit that documents the whole feature',
  ],
  [
    '/api/notifications/push/subscriptions/{id}',
    'Web push feature route; OpenAPI spec entry lands in the follow-up commit that documents the whole feature',
  ],
]);

interface RouteFile {
  /** Spec-style path, e.g. /api/people/{id} */
  path: string;
  /** Repo-relative file path, for failure messages */
  file: string;
  source: string;
  methods: string[];
  sessionOnly: boolean;
}

function collectRouteFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectRouteFiles(full));
    else if (entry === 'route.ts') found.push(full);
  }
  return found;
}

function toSpecPath(file: string): string {
  const dir = relative(process.cwd(), file).replace(/[/\\]route\.ts$/, '');
  return (
    '/' +
    dir
      .replace(/^app[/\\]/, '')
      .split(/[/\\]/)
      .map((seg) =>
        seg
          .replace(/^\[\.\.\.(.+)\]$/, '{$1}')
          .replace(/^\[(.+)\]$/, '{$1}')
      )
      .join('/')
  );
}

const routes: RouteFile[] = collectRouteFiles(API_ROOT).map((file) => {
  const source = readFileSync(file, 'utf8');
  return {
    path: toSpecPath(file),
    file: relative(process.cwd(), file),
    source,
    methods: [
      ...new Set(
        [...source.matchAll(/export const (GET|POST|PUT|PATCH|DELETE)\b/g)].map(
          (m) => m[1].toLowerCase()
        )
      ),
    ],
    // Routes opted out of bearer-token auth via withAuth's options.
    sessionOnly: /allowApiToken:\s*false/.test(source),
  };
});

const spec = generateOpenAPISpec() as {
  paths: Record<string, Record<string, { security?: Array<Record<string, unknown>> }>>;
};

describe('OpenAPI coverage', () => {
  it('found the routes and the spec', () => {
    expect(routes.length).toBeGreaterThan(50);
    expect(Object.keys(spec.paths).length).toBeGreaterThan(50);
  });

  it('documents every API route, or explains the omission', () => {
    const undocumented = routes
      .filter((r) => !spec.paths[r.path])
      .filter((r) => !INTENTIONALLY_UNDOCUMENTED.has(r.path))
      .map((r) => `${r.path} (${r.file})`);

    expect(
      undocumented,
      'Add a path entry in lib/openapi/, or add the route to ' +
        'INTENTIONALLY_UNDOCUMENTED with a reason.'
    ).toEqual([]);
  });

  it('has no spec entries for routes that no longer exist', () => {
    const known = new Set(routes.map((r) => r.path));
    const stale = Object.keys(spec.paths).filter((p) => !known.has(p));

    expect(stale, 'These spec paths have no route file.').toEqual([]);
  });

  it('documents every HTTP method each route exports', () => {
    const gaps: string[] = [];

    for (const route of routes) {
      const entry = spec.paths[route.path];
      if (!entry) continue;
      for (const method of route.methods) {
        if (!entry[method]) gaps.push(`${method.toUpperCase()} ${route.path}`);
      }
    }

    expect(gaps, 'These handlers exist but are not in the spec.').toEqual([]);
  });

  it('marks session-only routes as session-only in the spec', () => {
    const wrong: string[] = [];

    for (const route of routes.filter((r) => r.sessionOnly)) {
      const entry = spec.paths[route.path];
      if (!entry) continue;

      for (const method of route.methods) {
        const security = entry[method]?.security;
        if (!security) continue;
        const acceptsToken = security.some((scheme) => 'apiToken' in scheme);
        if (acceptsToken) {
          wrong.push(
            `${method.toUpperCase()} ${route.path} uses allowApiToken: false ` +
              'but the spec advertises apiToken'
          );
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('advertises apiToken on the routes that accept it', () => {
    const wrong: string[] = [];

    for (const route of routes.filter((r) => !r.sessionOnly)) {
      // Only routes wrapped in withAuth participate in token auth. Cron jobs,
      // webhooks, and the public auth flows use their own schemes.
      if (!/withAuth\(/.test(route.source)) continue;

      const entry = spec.paths[route.path];
      if (!entry) continue;

      for (const method of route.methods) {
        const security = entry[method]?.security;
        if (!security) {
          wrong.push(`${method.toUpperCase()} ${route.path} declares no security`);
          continue;
        }
        if (!security.some((scheme) => 'apiToken' in scheme)) {
          wrong.push(
            `${method.toUpperCase()} ${route.path} accepts API tokens but the ` +
              'spec only advertises session'
          );
        }
      }
    }

    expect(wrong).toEqual([]);
  });
});
