import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLog,
  securityLogger: { rateLimitExceeded: vi.fn() },
  createModuleLogger: vi.fn(() => mockLog),
}));

import { POST } from '@/app/api/log-error/route';
import { resetRateLimit } from '@/lib/rate-limit';

function post(body: unknown, ip = '203.0.113.10') {
  return new Request('http://localhost:3000/api/log-error', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/log-error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimit(post({}, '203.0.113.10'), 'clientErrorLog');
  });

  it('records a client error report', async () => {
    const res = await POST(post({ message: 'boom', url: '/people' }));

    expect(res.status).toBe(200);
    expect(mockLog.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'boom', url: '/people' }),
      'Client-side error'
    );
  });

  it('rejects a payload that is too large instead of logging it', async () => {
    const res = await POST(post({ message: 'x'.repeat(200 * 1024) }));

    expect(res.status).toBe(413);
    expect(mockLog.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.any(String) }),
      'Client-side error'
    );
  });

  it('truncates oversized fields so one report cannot flood the log', async () => {
    await POST(post({ message: 'y'.repeat(5000), stack: 'z'.repeat(20000) }));

    const [logged] = mockLog.error.mock.calls[0];
    expect((logged.message as string).length).toBeLessThanOrEqual(1024);
    expect((logged.stack as string).length).toBeLessThanOrEqual(8192);
  });

  it('ignores non-string fields rather than logging arbitrary structures', async () => {
    await POST(post({ message: { nested: { deep: [1, 2, 3] } }, stack: 42 }));

    const [logged] = mockLog.error.mock.calls[0];
    expect(logged.message).toBeUndefined();
    expect(logged.stack).toBeUndefined();
  });

  it('rate limits a client that floods the endpoint', async () => {
    const ip = '198.51.100.7';
    resetRateLimit(post({}, ip), 'clientErrorLog');

    let limited: Response | undefined;
    for (let i = 0; i < 80; i++) {
      const res = await POST(post({ message: `err ${i}` }, ip));
      if (res.status === 429) {
        limited = res;
        break;
      }
    }

    expect(limited, 'endpoint accepted 80 reports without rate limiting').toBeDefined();
    expect(limited!.status).toBe(429);
  });
});
