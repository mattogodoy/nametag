import { describe, it, expect } from 'vitest';
import { getRetryAfterSeconds } from '../../lib/retry-after';

describe('getRetryAfterSeconds', () => {
  it('reads params.retryAfter from a coded cooldown response', () => {
    expect(getRetryAfterSeconds({ code: 'rate_limited', params: { retryAfter: 42 } }, 120)).toBe(42);
  });
  it('reads the top-level retryAfter from the rate limiter response', () => {
    expect(getRetryAfterSeconds({ code: 'rate_limited', retryAfter: 30 }, 120)).toBe(30);
  });
  it('falls back when absent or invalid', () => {
    expect(getRetryAfterSeconds({ error: 'x' }, 120)).toBe(120);
    expect(getRetryAfterSeconds(null, 120)).toBe(120);
    expect(getRetryAfterSeconds({ params: { retryAfter: 'soon' } }, 120)).toBe(120);
  });
});
