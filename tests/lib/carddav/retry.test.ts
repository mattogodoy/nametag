/**
 * Unit tests for CardDAV retry utility and error categorization
 */

import { describe, it, expect, vi } from 'vitest';
import {
  withRetry,
  categorizeError,
  ErrorCategory,
} from '@/lib/carddav/retry';

describe('withRetry', () => {
  it('returns on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { initialDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 server error then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('server error'), { status: 500 })
      )
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 502 server error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('bad gateway'), { status: 502 })
      )
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 server error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('service unavailable'), { status: 503 })
      )
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 rate limit', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('too many requests'), { status: 429 })
      )
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on network error (ECONNREFUSED)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:443'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on timeout error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on ENOTFOUND error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('getaddrinfo ENOTFOUND contacts.example.com')
      )
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on generic network error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { initialDelay: 1, maxDelay: 2 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 401 auth error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('unauthorized'), { status: 401 })
      );

    await expect(
      withRetry(fn, { initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 forbidden error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('forbidden'), { status: 403 })
      );

    await expect(
      withRetry(fn, { initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('forbidden');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 404 not found', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('not found'), { status: 404 })
      );

    await expect(
      withRetry(fn, { initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 400 bad request', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('bad request'), { status: 400 })
      );

    await expect(
      withRetry(fn, { initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on non-retryable generic errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('some random error'));

    await expect(
      withRetry(fn, { initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('some random error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts option', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('server error'), { status: 500 })
      );

    await expect(
      withRetry(fn, { maxAttempts: 3, initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('respects maxAttempts of 1 (no retries)', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('server error'), { status: 500 })
      );

    await expect(
      withRetry(fn, { maxAttempts: 1, initialDelay: 1 })
    ).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts of 5', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('server error'), { status: 500 })
      );

    await expect(
      withRetry(fn, { maxAttempts: 5, initialDelay: 1, maxDelay: 2 })
    ).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('uses default maxAttempts of 3 when not specified', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('server error'), { status: 500 })
      );

    await expect(withRetry(fn, { initialDelay: 1, maxDelay: 2 })).rejects.toThrow(
      'server error'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('succeeds on the last attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 500 })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 500 })
      )
      .mockResolvedValue('finally');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      initialDelay: 1,
      maxDelay: 2,
    });
    expect(result).toBe('finally');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('accepts a custom shouldRetry function', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom retryable'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      initialDelay: 1,
      shouldRetry: (error: unknown) =>
        error instanceof Error && error.message.includes('custom retryable'),
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('custom shouldRetry can prevent retry', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('server error'), { status: 500 })
      );

    await expect(
      withRetry(fn, {
        initialDelay: 1,
        shouldRetry: () => false,
      })
    ).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff between retries', async () => {
    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 500 })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 500 })
      )
      .mockResolvedValue('ok');

    await withRetry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      backoffFactor: 2,
      maxDelay: 10000,
    });

    // Find the setTimeout calls made during retry
    const retryCalls = sleepSpy.mock.calls.filter(
      (call) => typeof call[1] === 'number' && call[1] >= 100
    );
    expect(retryCalls.length).toBeGreaterThanOrEqual(2);
    // First delay should be 100ms, second should be 200ms
    expect(retryCalls[0][1]).toBe(100);
    expect(retryCalls[1][1]).toBe(200);

    sleepSpy.mockRestore();
  });

  it('caps delay at maxDelay', async () => {
    const sleepSpy = vi.spyOn(globalThis, 'setTimeout');

    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 500 })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 500 })
      )
      .mockResolvedValue('ok');

    await withRetry(fn, {
      maxAttempts: 3,
      initialDelay: 100,
      backoffFactor: 10,
      maxDelay: 150,
    });

    const retryCalls = sleepSpy.mock.calls.filter(
      (call) => typeof call[1] === 'number' && call[1] >= 100
    );
    expect(retryCalls.length).toBeGreaterThanOrEqual(2);
    // First delay: 100, second: min(100*10, 150) = 150
    expect(retryCalls[0][1]).toBe(100);
    expect(retryCalls[1][1]).toBe(150);

    sleepSpy.mockRestore();
  });
});

describe('categorizeError', () => {
  describe('AUTH errors', () => {
    it('categorizes 401 as AUTH', () => {
      const result = categorizeError(
        Object.assign(new Error('unauthorized'), { status: 401 })
      );
      expect(result.category).toBe(ErrorCategory.AUTH);
      expect(result.message).toBe('unauthorized');
      expect(result.originalError).toBeDefined();
      expect(result.userMessage).toContain('Authentication failed');
    });

    it('categorizes 403 as AUTH', () => {
      const result = categorizeError(
        Object.assign(new Error('forbidden'), { status: 403 })
      );
      expect(result.category).toBe(ErrorCategory.AUTH);
      expect(result.userMessage).toContain('app-specific password');
    });
  });

  describe('RATE_LIMIT errors', () => {
    it('categorizes 429 as RATE_LIMIT', () => {
      const result = categorizeError(
        Object.assign(new Error('too many requests'), { status: 429 })
      );
      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
      expect(result.userMessage).toContain('Too many requests');
    });
  });

  describe('SERVER errors', () => {
    it('categorizes 500 as SERVER', () => {
      const result = categorizeError(
        Object.assign(new Error('internal server error'), { status: 500 })
      );
      expect(result.category).toBe(ErrorCategory.SERVER);
      expect(result.userMessage).toContain('server is experiencing issues');
    });

    it('categorizes 502 as SERVER', () => {
      const result = categorizeError(
        Object.assign(new Error('bad gateway'), { status: 502 })
      );
      expect(result.category).toBe(ErrorCategory.SERVER);
    });

    it('categorizes 503 as SERVER', () => {
      const result = categorizeError(
        Object.assign(new Error('service unavailable'), { status: 503 })
      );
      expect(result.category).toBe(ErrorCategory.SERVER);
    });
  });

  describe('NOT_FOUND errors', () => {
    it('categorizes 404 as NOT_FOUND', () => {
      const result = categorizeError(
        Object.assign(new Error('not found'), { status: 404 })
      );
      expect(result.category).toBe(ErrorCategory.NOT_FOUND);
      expect(result.userMessage).toContain('not found');
    });
  });

  describe('NETWORK errors', () => {
    it('categorizes ECONNREFUSED as NETWORK', () => {
      const result = categorizeError(
        new Error('connect ECONNREFUSED 127.0.0.1:443')
      );
      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.userMessage).toContain('Network error');
    });

    it('categorizes ENOTFOUND as NETWORK', () => {
      const result = categorizeError(
        new Error('getaddrinfo ENOTFOUND contacts.example.com')
      );
      expect(result.category).toBe(ErrorCategory.NETWORK);
    });

    it('categorizes timeout as NETWORK', () => {
      const result = categorizeError(new Error('Request timeout'));
      expect(result.category).toBe(ErrorCategory.NETWORK);
    });

    it('categorizes generic network error as NETWORK', () => {
      const result = categorizeError(new Error('Network error'));
      expect(result.category).toBe(ErrorCategory.NETWORK);
    });

    it('categorizes DNS error as NETWORK', () => {
      const result = categorizeError(new Error('DNS resolution failed'));
      expect(result.category).toBe(ErrorCategory.NETWORK);
    });
  });

  describe('MALFORMED errors', () => {
    it('categorizes parse errors as MALFORMED', () => {
      const result = categorizeError(new Error('Failed to parse vCard'));
      expect(result.category).toBe(ErrorCategory.MALFORMED);
      expect(result.userMessage).toContain('Invalid data');
    });

    it('categorizes malformed data as MALFORMED', () => {
      const result = categorizeError(new Error('Malformed response body'));
      expect(result.category).toBe(ErrorCategory.MALFORMED);
    });

    it('categorizes invalid data as MALFORMED', () => {
      const result = categorizeError(new Error('Invalid XML structure'));
      expect(result.category).toBe(ErrorCategory.MALFORMED);
    });
  });

  describe('UNKNOWN errors', () => {
    it('categorizes unknown errors as UNKNOWN', () => {
      const result = categorizeError(new Error('something unexpected'));
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.userMessage).toContain('unexpected error');
    });

    it('handles non-Error objects', () => {
      const result = categorizeError('string error');
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBe('string error');
    });

    it('throws on null input (no null guard in source)', () => {
      // categorizeError casts the input to { status?: number } and accesses
      // .status without a null check, so null/undefined inputs will throw.
      expect(() => categorizeError(null)).toThrow();
    });

    it('handles numeric errors', () => {
      const result = categorizeError(42);
      expect(result.category).toBe(ErrorCategory.UNKNOWN);
      expect(result.message).toBe('42');
    });
  });

  describe('return structure', () => {
    it('always returns category, message, originalError, and userMessage', () => {
      const error = new Error('test');
      const result = categorizeError(error);

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('originalError');
      expect(result).toHaveProperty('userMessage');
      expect(result.originalError).toBe(error);
    });

    it('userMessage is always a non-empty string', () => {
      const testCases = [
        Object.assign(new Error(''), { status: 401 }),
        Object.assign(new Error(''), { status: 429 }),
        Object.assign(new Error(''), { status: 500 }),
        Object.assign(new Error(''), { status: 404 }),
        new Error('ECONNREFUSED'),
        new Error('parse error'),
        new Error('unknown'),
      ];

      for (const error of testCases) {
        const result = categorizeError(error);
        expect(typeof result.userMessage).toBe('string');
        expect(result.userMessage.length).toBeGreaterThan(0);
      }
    });
  });

  describe('priority ordering', () => {
    it('HTTP status takes priority over message-based matching', () => {
      // A 401 error with "parse" in the message should still be AUTH, not MALFORMED
      const result = categorizeError(
        Object.assign(new Error('parse error during auth'), { status: 401 })
      );
      expect(result.category).toBe(ErrorCategory.AUTH);
    });

    it('429 takes priority over message-based matching', () => {
      const result = categorizeError(
        Object.assign(new Error('network timeout'), { status: 429 })
      );
      expect(result.category).toBe(ErrorCategory.RATE_LIMIT);
    });

    it('5xx takes priority over message-based matching', () => {
      const result = categorizeError(
        Object.assign(new Error('invalid parse malformed'), { status: 503 })
      );
      expect(result.category).toBe(ErrorCategory.SERVER);
    });
  });
});

describe('ErrorCategory enum', () => {
  it('has all expected values', () => {
    expect(ErrorCategory.AUTH).toBe('auth');
    expect(ErrorCategory.NETWORK).toBe('network');
    expect(ErrorCategory.SERVER).toBe('server');
    expect(ErrorCategory.RATE_LIMIT).toBe('rate_limit');
    expect(ErrorCategory.MALFORMED).toBe('malformed');
    expect(ErrorCategory.NOT_FOUND).toBe('not_found');
    expect(ErrorCategory.UNKNOWN).toBe('unknown');
  });
});
