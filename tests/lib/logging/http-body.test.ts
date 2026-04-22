import { describe, it, expect } from 'vitest';
import { readBodySafely } from '@/lib/logging/http-body';

function makeResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

describe('readBodySafely', () => {
  it('returns the body verbatim when under the limit', async () => {
    const res = makeResponse('short body');
    expect(await readBodySafely(res)).toBe('short body');
  });

  it('truncates bodies over 2048 bytes and marks them', async () => {
    const large = 'x'.repeat(3000);
    const res = makeResponse(large);
    const result = await readBodySafely(res);
    expect(result!.length).toBe(2048 + '…[truncated]'.length);
    expect(result!.endsWith('…[truncated]')).toBe(true);
  });

  it('returns undefined when body has already been consumed', async () => {
    const res = makeResponse('once');
    await res.text();
    expect(await readBodySafely(res)).toBeUndefined();
  });

  it('returns <unreadable> when .text() throws', async () => {
    const res = {
      bodyUsed: false,
      text: () => Promise.reject(new Error('bad bytes')),
    } as unknown as Response;
    expect(await readBodySafely(res)).toBe('<unreadable>');
  });
});
