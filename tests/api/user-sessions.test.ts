import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  revoke: vi.fn(),
  revokeOthers: vi.fn(),
  session: null as Record<string, unknown> | null,
  options: [] as unknown[],
}));

vi.mock('@/lib/native-auth/sessions', () => ({
  listDeviceSessions: mocks.list,
  revokeDeviceSession: mocks.revoke,
  revokeOtherDeviceSessions: mocks.revokeOthers,
}));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (
      handler: (req: Request, session: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>,
      options?: unknown
    ) => {
      mocks.options.push(options);
      return (req: Request, ctx?: { params: Promise<Record<string, string>> }) =>
        handler(req, mocks.session, ctx ?? { params: Promise.resolve({}) });
    },
  };
});

import { GET, DELETE as DELETE_ALL } from '@/app/api/user/sessions/route';
import { DELETE } from '@/app/api/user/sessions/[id]/route';

const row = (id: string) => ({
  id,
  name: 'Phone',
  platform: 'IOS',
  appVersion: '1.0.0',
  lastUsedAt: new Date('2026-10-17T10:00:00.000Z'),
  createdAt: new Date('2026-10-01T10:00:00.000Z'),
});

describe('/api/user/sessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses personal API tokens on every handler', () => {
    expect(mocks.options).toHaveLength(3);
    for (const options of mocks.options) {
      expect(options).toEqual({ allowApiTokens: false });
    }
  });

  it('lists the user\'s devices and marks the calling device as current', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'device', deviceSessionId: 's2' };
    mocks.list.mockResolvedValue([row('s1'), row('s2')]);

    const res = await GET(new Request('http://localhost/api/user/sessions'));
    const body = await res.json();

    expect(mocks.list).toHaveBeenCalledWith('u1');
    expect(body.sessions.map((s: { id: string; current: boolean }) => [s.id, s.current])).toEqual([
      ['s1', false],
      ['s2', true],
    ]);
    expect(body.sessions[0].lastUsedAt).toBe('2026-10-17T10:00:00.000Z');
    expect(JSON.stringify(body)).not.toMatch(/Hash/);
  });

  it('marks nothing as current for a browser session', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'session' };
    mocks.list.mockResolvedValue([row('s1')]);
    const body = await (await GET(new Request('http://localhost/api/user/sessions'))).json();
    expect(body.sessions[0].current).toBe(false);
  });

  it('revokes one of the user\'s devices', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'session' };
    mocks.revoke.mockResolvedValue(true);
    const res = await DELETE(new Request('http://localhost/api/user/sessions/s1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 's1' }),
    });
    expect(res.status).toBe(204);
    expect(mocks.revoke).toHaveBeenCalledWith('u1', 's1');
  });

  it('returns 404 for another user\'s or an unknown device', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'session' };
    mocks.revoke.mockResolvedValue(false);
    const res = await DELETE(new Request('http://localhost/api/user/sessions/x', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'x' }),
    });
    expect(res.status).toBe(404);
  });

  it('signs out all other devices and keeps the caller', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'device', deviceSessionId: 's2' };
    mocks.revokeOthers.mockResolvedValue(3);
    const res = await DELETE_ALL(new Request('http://localhost/api/user/sessions', { method: 'DELETE' }));
    expect(res.status).toBe(204);
    expect(mocks.revokeOthers).toHaveBeenCalledWith('u1', 's2');
  });

  it('signs out every device when called from a browser', async () => {
    mocks.session = { user: { id: 'u1' }, authMethod: 'session' };
    mocks.revokeOthers.mockResolvedValue(2);
    await DELETE_ALL(new Request('http://localhost/api/user/sessions', { method: 'DELETE' }));
    expect(mocks.revokeOthers).toHaveBeenCalledWith('u1', null);
  });
});
