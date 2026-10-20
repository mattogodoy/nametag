import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth } from '@/lib/auth';

const mocks = vi.hoisted(() => ({ discoverNewContacts: vi.fn() }));

vi.mock('@/lib/auth');
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => null }));
vi.mock('@/lib/carddav/discover', () => ({ discoverNewContacts: mocks.discoverNewContacts }));
vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/carddav/discover/route';

const req = () => new Request('http://localhost/api/carddav/discover', { method: 'POST' });

describe('POST /api/carddav/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: 'user-1', email: 'u@example.com' } });
  });

  it('returns the discovery result on success', async () => {
    mocks.discoverNewContacts.mockResolvedValue({ discovered: 2, errors: 0, errorMessages: [] });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, discovered: 2, errors: 0, errorMessages: [] });
  });

  it('returns a coded error and does not leak the exception text on failure', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    mocks.discoverNewContacts.mockRejectedValue(new Error('secret dav host dav.internal refused'));
    const res = await POST(req());
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.code).toBe('internal_error');
    expect(JSON.stringify(data)).not.toContain('dav.internal');
  });
});
