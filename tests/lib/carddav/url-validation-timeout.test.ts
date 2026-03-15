import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
  isSaasMode: vi.fn(),
}));

vi.mock('dns', () => ({
  default: {
    promises: {
      resolve4: mocks.resolve4,
      resolve6: mocks.resolve6,
    },
  },
  promises: {
    resolve4: mocks.resolve4,
    resolve6: mocks.resolve6,
  },
}));

vi.mock('@/lib/features', () => ({
  isSaasMode: mocks.isSaasMode,
}));

import { validateServerUrl } from '@/lib/carddav/url-validation';

describe('DNS resolution timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should reject URLs when DNS resolution takes longer than 5 seconds', async () => {
    mocks.isSaasMode.mockReturnValue(true);
    // Promises that only resolve after a very long delay (simulating slow DNS)
    mocks.resolve4.mockReturnValue(new Promise((resolve) => setTimeout(() => resolve([]), 60000)));
    mocks.resolve6.mockReturnValue(new Promise((resolve) => setTimeout(() => resolve([]), 60000)));

    const promise = validateServerUrl('https://slow-dns.example.com/');
    // Attach rejection handler immediately to prevent unhandled rejection warnings
    const caught = promise.catch((err: Error) => err);
    await vi.advanceTimersByTimeAsync(6000);
    const result = await caught;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/timeout|resolve/i);
  });
});
