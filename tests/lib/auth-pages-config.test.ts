import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// NextAuth reduces most failures to an error redirect. Routing them to /login
// lets the page forward a pending native sign-in to its completion step.
describe('NextAuth pages config', () => {
  const source = readFileSync(join(__dirname, '../../lib/auth.ts'), 'utf8');
  const pages = source.match(/pages:\s*\{([^}]*)\}/)?.[1] ?? '';

  it('sends sign-in screens to /login', () => {
    expect(pages).toMatch(/signIn:\s*'\/login'/);
  });

  it('sends errors to /login', () => {
    expect(pages).toMatch(/error:\s*'\/login'/);
  });
});
