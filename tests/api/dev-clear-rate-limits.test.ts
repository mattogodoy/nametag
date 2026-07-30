import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockRedis = vi.hoisted(() => ({
  keys: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => mockRedis),
  isRedisConnected: vi.fn(() => true),
}));

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLog,
  securityLogger: {
    authFailure: vi.fn(),
    rateLimitExceeded: vi.fn(),
  },
  createModuleLogger: vi.fn(() => mockLog),
}));

import { DELETE } from '@/app/api/dev/clear-rate-limits/route';

const SECRET = 'test-cron-secret-value';

function request(opts: { auth?: string; query?: string } = {}) {
  return new Request(
    `http://localhost:3000/api/dev/clear-rate-limits?${opts.query ?? 'all=true'}`,
    {
      method: 'DELETE',
      headers: opts.auth ? { authorization: opts.auth } : {},
    }
  );
}

describe('DELETE /api/dev/clear-rate-limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
    mockRedis.keys.mockResolvedValue(['ratelimit:login:1.2.3.4']);
    mockRedis.del.mockResolvedValue(1);
  });

  it('requires the shared secret even outside production', async () => {
    // The old guard was `NODE_ENV !== 'production' || bearer === CRON_SECRET`,
    // which left the endpoint wide open whenever NODE_ENV was unset. The
    // standalone server started with `node server.js` does not set it.
    const previous = process.env.NODE_ENV;
    (process.env as { NODE_ENV?: string }).NODE_ENV = undefined;

    try {
      const res = await DELETE(request());

      expect(res.status).toBe(401);
      expect(mockRedis.del).not.toHaveBeenCalled();
    } finally {
      (process.env as { NODE_ENV?: string }).NODE_ENV = previous;
    }
  });

  it('rejects a wrong secret', async () => {
    const res = await DELETE(request({ auth: 'Bearer not-the-secret' }));

    expect(res.status).toBe(401);
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('clears matching keys when the secret is correct', async () => {
    const res = await DELETE(request({ auth: `Bearer ${SECRET}` }));

    expect(res.status).toBe(200);
    expect(mockRedis.del).toHaveBeenCalledWith('ratelimit:login:1.2.3.4');
  });

  it('does not echo the rate-limit keys back to the caller', async () => {
    mockRedis.keys.mockResolvedValue([
      'ratelimit:login:203.0.113.9:victim@example.com',
    ]);

    const res = await DELETE(request({ auth: `Bearer ${SECRET}` }));
    const raw = await res.text();

    expect(raw).not.toContain('victim@example.com');
    expect(raw).not.toContain('203.0.113.9');
  });

  it('does not leak internal error details when Redis fails', async () => {
    mockRedis.keys.mockRejectedValue(
      new Error('READONLY replica at redis.internal:6379')
    );

    const res = await DELETE(request({ auth: `Bearer ${SECRET}` }));
    const raw = await res.text();

    expect(res.status).toBe(500);
    expect(raw).not.toContain('redis.internal');
  });
});
