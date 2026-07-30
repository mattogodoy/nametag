import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withAuth, apiResponse } from '@/lib/api-utils';
import { auth } from '@/lib/auth';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));

vi.mock('@/lib/api-tokens', () => ({ resolveApiToken: vi.fn() }));

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLog,
  securityLogger: mockLog,
  createModuleLogger: vi.fn(() => mockLog),
}));

vi.mock('@/lib/env', () => ({
  getAppUrl: () => 'http://localhost:3000',
  env: { NEXTAUTH_URL: 'http://localhost:3000' },
  getEnv: () => ({ NEXTAUTH_URL: 'http://localhost:3000' }),
}));

const handler = vi.fn(async () => apiResponse.ok({ ok: true }));

function request(method: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/test', {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: '{}' }),
  });
}

describe('withAuth same-origin enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user1' },
    } as unknown as Awaited<ReturnType<typeof auth>>);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'rejects a cross-origin %s request with 403',
    async (method) => {
      const res = await withAuth(handler)(
        request(method, { origin: 'https://evil.example' })
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Invalid request origin' });
      expect(handler).not.toHaveBeenCalled();
    }
  );

  it('rejects a cross-origin request identified only by Referer', async () => {
    const res = await withAuth(handler)(
      request('POST', { referer: 'https://evil.example/attack.html' })
    );

    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('allows a same-origin state-changing request', async () => {
    const res = await withAuth(handler)(
      request('POST', { origin: 'http://localhost:3000' })
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });

  it('allows a cross-origin GET, which cannot change state', async () => {
    const res = await withAuth(handler)(
      request('GET', { origin: 'https://evil.example' })
    );

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalled();
  });
});
