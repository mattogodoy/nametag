import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RAW_ERROR_ALLOWLIST } from './error-codes-allowlist';

const ROOT = process.cwd();
const JSON_CALL = /\b(?:NextResponse|Response)\.json\s*\(/g;
const OK_CALL = /\bapiResponse\.ok\s*\(/g;

/** Index just past the bracket that closes the one at `open`, skipping strings. */
function closeIndex(src: string, open: number): number {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) return i + 1;
    }
  }
  return src.length;
}

/** Top-level text of a bracketed region: nested brackets and strings blanked out. */
function topLevel(src: string, open: number): string {
  const end = closeIndex(src, open);
  let out = '';
  let depth = 0;
  for (let i = open; i < end; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') {
      const q = c;
      for (i++; i < end && src[i] !== q; i++) if (src[i] === '\\') i++;
      out += depth === 1 ? ' ' : '';
      continue;
    }
    if (c === '(' || c === '{' || c === '[') depth++;
    if (depth === 1) out += c;
    if (c === ')' || c === '}' || c === ']') depth--;
  }
  return out;
}

function calls(source: string, re: RegExp): number[] {
  return [...source.matchAll(re)].map((m) => (m.index ?? 0) + m[0].length - 1);
}

/** A hand-built { error } body (any key position, or shorthand) without a code key. */
function hasUncodedError(source: string): boolean {
  return calls(source, JSON_CALL).some((paren) => {
    const arg = source.slice(paren + 1).trimStart();
    if (!arg.startsWith('{')) return false;
    const brace = source.indexOf('{', paren);
    const keys = topLevel(source, brace);
    return /[{,]\s*error\s*[:,}]/.test(keys) && !/[{,]\s*code\s*[:,}]/.test(keys);
  });
}

/** apiResponse.ok(data, 4xx/5xx): an error with no code. */
function hasOkWithErrorStatus(source: string): boolean {
  return calls(source, OK_CALL).some((paren) => {
    const args = topLevel(source, paren);
    return /,\s*[45]\d\d\s*\)$/.test(args.trim());
  });
}

export function hasRawError(source: string): boolean {
  return hasUncodedError(source) || hasOkWithErrorStatus(source);
}

function files(dir: string, match: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? files(p, match) : match(e) ? [p] : [];
  });
}

describe('error code guard', () => {
  it('detects single-line and multi-line raw error responses', () => {
    expect(hasRawError("return NextResponse.json({ error: 'x' }, { status: 400 });")).toBe(true);
    expect(hasRawError("return NextResponse.json(\n  {\n    error:\n      'x',\n  },\n  { status: 400 }\n);")).toBe(true);
    expect(hasRawError('return NextResponse.json({ ok: true });')).toBe(false);
  });

  it('detects an error key in any position and shorthand', () => {
    expect(hasRawError("NextResponse.json({ message: 'm', error: 'x' }, { status: 400 })")).toBe(true);
    expect(hasRawError("NextResponse.json({ error }, { status: 400 })")).toBe(true);
    expect(hasRawError("NextResponse.json({ retryAfter: 1, error: `a ${b}` }, { status: 429 })")).toBe(true);
    expect(hasRawError("Response.json({ error: 'x' }, { status: 400 })")).toBe(true);
  });

  it('detects apiResponse.ok with an error status', () => {
    expect(hasRawError("apiResponse.ok({ success: false }, 500)")).toBe(true);
    expect(hasRawError("apiResponse.ok({ a: foo(1, 2) },\n 404\n)")).toBe(true);
  });

  it('does not flag coded or success bodies', () => {
    expect(hasRawError("NextResponse.json({ error: 'x', code: 'rate_limited' }, { status: 429 })")).toBe(false);
    expect(hasRawError("NextResponse.json({ code: c, error: m }, { status: 400 })")).toBe(false);
    expect(hasRawError("NextResponse.json(data, { status: 400 })")).toBe(false);
    expect(hasRawError("NextResponse.json({ data: { error: 'nested' } })")).toBe(false);
    expect(hasRawError("apiResponse.ok({ valid: false, error: 'people' })")).toBe(false);
    expect(hasRawError("apiResponse.ok({ n: 1 }, 201)")).toBe(false);
  });

  it('no route or lib module builds an error response by hand outside the allowlist', () => {
    const targets = [
      ...files(join(ROOT, 'app', 'api'), (n) => n === 'route.ts'),
      ...files(join(ROOT, 'lib'), (n) => n.endsWith('.ts')),
    ].map((f) => relative(ROOT, f));
    const offenders = targets
      .filter((f) => !RAW_ERROR_ALLOWLIST.has(f))
      .filter((f) => hasRawError(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('allowlist has no stale entries', () => {
    const stale = [...RAW_ERROR_ALLOWLIST.keys()].filter((f) => !hasRawError(readFileSync(f, 'utf8')));
    expect(stale).toEqual([]);
  });
});
