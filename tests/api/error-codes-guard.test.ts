import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAW_ERROR_ALLOWLIST } from './error-codes-allowlist';

const API_ROOT = join(process.cwd(), 'app', 'api');
// NextResponse.json( followed (across lines) by an object literal with an error key.
const RAW_ERROR = /NextResponse\.json\(\s*\{\s*error\s*:/;

export function hasRawError(source: string): boolean {
  return RAW_ERROR.test(source);
}

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? routes(p) : e === 'route.ts' ? [p] : [];
  });
}

describe('error code guard', () => {
  it('detects single-line and multi-line raw error responses', () => {
    expect(hasRawError("return NextResponse.json({ error: 'x' }, { status: 400 });")).toBe(true);
    expect(hasRawError("return NextResponse.json(\n  {\n    error:\n      'x',\n  },\n  { status: 400 }\n);")).toBe(true);
    expect(hasRawError("return NextResponse.json({ ok: true });")).toBe(false);
  });

  it('no route builds an error response by hand outside the allowlist', () => {
    const offenders = routes(API_ROOT)
      .map((f) => relative(process.cwd(), f))
      .filter((f) => !RAW_ERROR_ALLOWLIST.has(f))
      .filter((f) => hasRawError(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('allowlist has no stale entries', () => {
    const stale = [...RAW_ERROR_ALLOWLIST.keys()].filter((f) => !hasRawError(readFileSync(f, 'utf8')));
    expect(stale).toEqual([]);
  });
});
