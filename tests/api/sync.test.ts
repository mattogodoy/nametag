import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getChangesSince: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prismaIncludingDeleted: {},
}));
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'user-1', email: 'a@b.c', name: 'A' } })),
}));
vi.mock('../../lib/sync/changes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/sync/changes')>()),
  getChangesSince: mocks.getChangesSince,
}));

import { GET } from '../../app/api/sync/route';

const emptyPage = {
  cursor: '5', hasMore: false, deleted: [],
  changes: { people: [], groups: [], relationships: [], importantDates: [], relationshipTypes: [], journalEntries: [], customFieldTemplates: [] },
};

function call(qs: string) {
  return GET(new Request(`http://localhost/api/sync${qs}`), { params: Promise.resolve({}) });
}

describe('GET /api/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getChangesSince.mockResolvedValue({ status: 'ok', page: emptyPage });
  });

  it('returns a page and passes cursor and default limit', async () => {
    const res = await call('?cursor=5');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(emptyPage);
    expect(mocks.getChangesSince).toHaveBeenCalledWith(expect.anything(), 'user-1', { seq: BigInt(5), fullSyncFloor: null }, 500);
  });

  it('returns 401 when the user no longer exists', async () => {
    mocks.getChangesSince.mockResolvedValue({ status: 'no_user' });
    const res = await call('?cursor=0');
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('unauthorized');
  });

  it('passes a full-sync cursor with its floor', async () => {
    await call('?cursor=7%3A9');
    expect(mocks.getChangesSince).toHaveBeenCalledWith(expect.anything(), 'user-1', { seq: BigInt(7), fullSyncFloor: BigInt(9) }, 500);
  });

  it('returns 410 sync_cursor_expired when the read reports expired', async () => {
    mocks.getChangesSince.mockResolvedValue({ status: 'expired' });
    const res = await call('?cursor=3');
    expect(res.status).toBe(410);
    expect((await res.json()).code).toBe('sync_cursor_expired');
  });

  it('returns 400 invalid_query on param cursor when the read reports ahead', async () => {
    mocks.getChangesSince.mockResolvedValue({ status: 'ahead' });
    const res = await call('?cursor=11');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('invalid_query');
    expect(body.params.param).toBe('cursor');
    expect(body.message ?? body.error).toContain('ahead');
  });

  it.each(['', '?cursor=', '?cursor=-1', '?cursor=1.5', '?cursor=abc', '?cursor=1:', '?cursor=:4', '?cursor=1:2:3'])(
    'returns 400 invalid_query for %s', async (qs) => {
      const res = await call(qs);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('invalid_query');
      expect(body.params.param).toBe('cursor');
      expect(mocks.getChangesSince).not.toHaveBeenCalled();
    }
  );

  it('clamps limit to 1000 and rejects non-positive limits', async () => {
    await call('?cursor=0&limit=5000');
    expect(mocks.getChangesSince).toHaveBeenCalledWith(expect.anything(), 'user-1', { seq: BigInt(0), fullSyncFloor: null }, 1000);
    const res = await call('?cursor=0&limit=0');
    expect(res.status).toBe(400);
    expect((await res.json()).params.param).toBe('limit');
  });
});
