import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// A transaction that writes a synced table can lose a delta sync deadlock
// (lib/db/deadlock.ts). The app client reruns only standalone queries, so
// every transaction must be wrapped whole in withDeadlockRetry, unless it is
// listed here with the reason it cannot deadlock.
const ALLOWED: Record<string, string> = {
  'app/api/carddav/connection/route.ts': 'deletes CardDAV mappings, pending imports and the connection; no synced table',
  'app/api/notifications/endpoints/route.ts': 'locks the user row first, then writes endpoints only; holds no entity lock',
  'app/api/notifications/push/subscribe/route.ts': 'locks the user row first, then writes push subscriptions only',
  'lib/session-invalidation.ts': 'updates the user row and device sessions; no synced table',
  'lib/billing/subscription.ts': 'writes promotions only; no synced table',
  'lib/sync/changes.ts': 'read-only snapshot',
  'lib/sync/tombstones.ts': 'deletes tombstones and raises the floor; no synced table',
};

const ROOT = process.cwd();
const CALL = /\.\$transaction\s*\(/g;
const WRAPPED = /withDeadlockRetry\(\s*\(\)\s*=>\s*$/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('transactions retry sync deadlocks', () => {
  const files = [...sources(join(ROOT, 'app')), ...sources(join(ROOT, 'lib'))];

  it('wraps every transaction outside the allowlist in withDeadlockRetry', () => {
    const unwrapped: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file);
      if (ALLOWED[rel]) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(CALL)) {
        const before = src.slice(0, m.index).replace(/\s*\w+$/, '');
        if (/typeof\s+\w*$/.test(before) || src.slice(src.lastIndexOf('\n', m.index) + 1, m.index).trim().startsWith('//')) continue;
        if (!WRAPPED.test(before)) {
          unwrapped.push(`${rel}:${src.slice(0, m.index).split('\n').length}`);
        }
      }
    }
    expect(unwrapped).toEqual([]);
  });

  it('keeps the allowlist to files that still run a transaction', () => {
    const stale = Object.keys(ALLOWED).filter(
      (rel) => !/\.\$transaction\s*\(/.test(readFileSync(join(ROOT, rel), 'utf8'))
    );
    expect(stale).toEqual([]);
  });
});
