import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ revokeDeviceSession: vi.fn(), session: null as Record<string, unknown> | null }));

vi.mock('@/lib/native-auth/sessions', () => ({ revokeDeviceSession: mocks.revokeDeviceSession }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (handler: (req: Request, session: unknown, ctx: unknown) => Promise<Response>) =>
      (req: Request) => handler(req, mocks.session, { params: Promise.resolve({}) }),
  };
});

import { POST } from '@/app/api/auth/native/logout/route';

describe('POST /api/auth/native/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revokeDeviceSession.mockResolvedValue(true);
  });

  it('deletes the calling device session and returns 204', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'device', deviceSessionId: 's1' };
    const res = await POST(new Request('http://localhost/api/auth/native/logout', { method: 'POST' }));
    expect(res.status).toBe(204);
    expect(mocks.revokeDeviceSession).toHaveBeenCalledWith('u1', 's1');
  });

  it.each(['session', 'apiToken'])('returns 400 not_a_device_session for %s auth', async (authMethod) => {
    mocks.session = { user: { id: 'u1' }, authMethod };
    const res = await POST(new Request('http://localhost/api/auth/native/logout', { method: 'POST' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('not_a_device_session');
    expect(mocks.revokeDeviceSession).not.toHaveBeenCalled();
  });
});
