import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * The mobile drawer is the only place a phone user can reach Settings,
 * Documentation and Sign out, and every one of those is gated on `userEmail`
 * reaching Navigation. A page that renders the nav without the account props
 * therefore strands mobile users with no way to sign out, which is exactly how
 * /people/merge and /people/duplicates shipped.
 */
const APP_DIR = join(process.cwd(), 'app');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

// `<Navigation` also prefixes `<NavigationSearch`, so require a boundary after it.
const RENDERS_NAV = /<Navigation[\s/>]/;

const navRenderers = walk(APP_DIR)
  .filter((file) => RENDERS_NAV.test(readFileSync(file, 'utf8')))
  .map((file) => file.slice(process.cwd().length + 1))
  .sort();

describe('Navigation account props', () => {
  it('finds the pages that render the nav', () => {
    // Guards the walk itself: a broken glob would make every case below vacuous.
    expect(navRenderers.length).toBeGreaterThan(20);
    expect(navRenderers).toContain('app/people/merge/page.tsx');
    expect(navRenderers).toContain('app/people/duplicates/page.tsx');
  });

  it.each(navRenderers)('%s passes the signed-in user to Navigation', (file) => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');

    expect(source).toMatch(/userEmail=/);
    expect(source).toMatch(/userName=/);
    expect(source).toMatch(/userNickname=/);
    expect(source).toMatch(/userPhoto=/);
  });
});
