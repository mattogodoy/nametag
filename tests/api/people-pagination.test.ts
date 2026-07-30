import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * GET /api/people returned every person the user owns, with every multi-value
 * relation joined and no upper bound. These tests pin the paging contract.
 */

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personCount: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
      count: mocks.personCount,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({ user: { id: 'user-123', email: 'test@example.com' } })
  ),
}));

vi.mock('../../lib/billing', () => ({
  canCreateResource: vi.fn(),
  canEnableReminder: vi.fn(),
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  securityLogger: { authFailure: vi.fn(), rateLimitExceeded: vi.fn() },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { GET } from '../../app/api/people/route';
import { DEFAULT_PEOPLE_PAGE_SIZE, MAX_PEOPLE_PAGE_SIZE } from '@/lib/constants';

function get(query = '') {
  return new Request(`http://localhost/api/people${query}`);
}

/** The findMany args from the most recent call. */
function lastFindManyArgs() {
  return mocks.personFindMany.mock.calls.at(-1)![0];
}

describe('GET /api/people paging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.personFindMany.mockResolvedValue([]);
    mocks.personCount.mockResolvedValue(0);
  });

  it('applies a default page size when the caller does not ask for one', async () => {
    await GET(get());

    expect(lastFindManyArgs().take).toBe(DEFAULT_PEOPLE_PAGE_SIZE);
    expect(lastFindManyArgs().skip).toBe(0);
  });

  it('honours an explicit limit and offset', async () => {
    await GET(get('?limit=25&offset=50'));

    expect(lastFindManyArgs().take).toBe(25);
    expect(lastFindManyArgs().skip).toBe(50);
  });

  it('caps limit at the maximum instead of trusting the caller', async () => {
    await GET(get(`?limit=${MAX_PEOPLE_PAGE_SIZE * 10}`));

    expect(lastFindManyArgs().take).toBe(MAX_PEOPLE_PAGE_SIZE);
  });

  it('rejects a limit that is not a positive integer', async () => {
    for (const bad of ['0', '-5', 'abc', '1.5', '']) {
      const res = await GET(get(`?limit=${bad}`));
      expect(res.status, `limit=${bad} should be rejected`).toBe(400);
    }
  });

  it('rejects a negative offset', async () => {
    const res = await GET(get('?offset=-1'));
    expect(res.status).toBe(400);
  });

  it('reports total, limit, offset, and hasMore', async () => {
    mocks.personFindMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
    mocks.personCount.mockResolvedValue(120);

    const res = await GET(get('?limit=2&offset=0'));
    const body = await res.json();

    expect(body.pagination).toEqual({
      total: 120,
      limit: 2,
      offset: 0,
      hasMore: true,
    });
  });

  it('reports hasMore false on the last page', async () => {
    mocks.personFindMany.mockResolvedValue([{ id: 'p1' }]);
    mocks.personCount.mockResolvedValue(101);

    const res = await GET(get('?limit=100&offset=100'));
    const body = await res.json();

    expect(body.pagination.hasMore).toBe(false);
  });

  it('counts with the same filter as the query it pages', async () => {
    await GET(get('?groupIds=g1,g2&limit=10'));

    const findWhere = lastFindManyArgs().where;
    const countWhere = mocks.personCount.mock.calls.at(-1)![0].where;

    // A count over a different filter would produce a wrong total and a
    // hasMore that lies.
    expect(countWhere).toEqual(findWhere);
  });

  it('still returns every person for an export', async () => {
    // A truncated export is silent data loss, so includeAll opts out of paging.
    mocks.personFindMany.mockResolvedValue([]);

    const res = await GET(get('?includeAll=true'));
    const body = await res.json();

    expect(lastFindManyArgs().take).toBeUndefined();
    expect(lastFindManyArgs().skip).toBeUndefined();
    expect(body.pagination).toBeUndefined();
  });

  it('honours an explicit limit even with includeAll', async () => {
    await GET(get('?includeAll=true&limit=10'));

    expect(lastFindManyArgs().take).toBe(10);
  });
});
