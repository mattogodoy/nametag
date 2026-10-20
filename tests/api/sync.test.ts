import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(),
  getChangesSince: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: { user: { findUnique: mocks.userFind } },
  prismaIncludingDeleted: {},
}));
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() => Promise.resolve({ user: { id: 'user-1', email: 'a@b.c', name: 'A' } })),
}));
vi.mock('../../lib/sync/changes', () => ({ getChangesSince: mocks.getChangesSince }));

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
    mocks.userFind.mockResolvedValue({ syncSeq: BigInt(10), syncTombstoneFloor: BigInt(4) });
    mocks.getChangesSince.mockResolvedValue(emptyPage);
  });

  it('returns a page and passes cursor and default limit', async () => {
    const res = await call('?cursor=5');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(emptyPage);
    expect(mocks.getChangesSince).toHaveBeenCalledWith(expect.anything(), 'user-1', BigInt(5), 500);
  });

  it('accepts cursor 0, a cursor equal to the floor, and one equal to syncSeq', async () => {
    expect((await call('?cursor=0')).status).toBe(200);
    expect((await call('?cursor=4')).status).toBe(200);
    expect((await call('?cursor=10')).status).toBe(200);
  });

  it('returns 410 sync_cursor_expired below the floor', async () => {
    const res = await call('?cursor=3');
    expect(res.status).toBe(410);
    expect((await res.json()).code).toBe('sync_cursor_expired');
    expect(mocks.getChangesSince).not.toHaveBeenCalled();
  });

  it.each(['', '?cursor=', '?cursor=-1', '?cursor=1.5', '?cursor=abc', '?cursor=11'])(
    'returns 400 invalid_query for %s', async (qs) => {
      const res = await call(qs);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.code).toBe('invalid_query');
      expect(body.params.param).toBe('cursor');
    }
  );

  it('clamps limit to 1000 and rejects non-positive limits', async () => {
    await call('?cursor=0&limit=5000');
    expect(mocks.getChangesSince).toHaveBeenCalledWith(expect.anything(), 'user-1', BigInt(0), 1000);
    const res = await call('?cursor=0&limit=0');
    expect(res.status).toBe(400);
    expect((await res.json()).params.param).toBe('limit');
  });
});
