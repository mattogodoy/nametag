import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_ERRORS } from '@/lib/api-errors';

const DOC = readFileSync(join(process.cwd(), 'docs/src/content/docs/api/errors.md'), 'utf8');

describe('errors docs page', () => {
  it('lists every code with its status, and no code that does not exist', () => {
    const rows = [...DOC.matchAll(/^\| `([a-z0-9_]+)` \| (\d{3}) \|/gm)].map((m) => [m[1], Number(m[2])]);
    expect(Object.fromEntries(rows)).toEqual(
      Object.fromEntries(Object.entries(API_ERRORS).map(([c, v]) => [c, v.status]))
    );
  });
});
