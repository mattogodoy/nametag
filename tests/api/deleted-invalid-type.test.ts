import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prismaIncludingDeleted: {} }));
vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-utils')>();
  return {
    ...actual,
    withAuth: (handler: (req: Request, session: unknown, ctx: unknown) => Promise<Response>) =>
      (req: Request) =>
        handler(req, { user: { id: 'u1' }, authMethod: 'session' }, { params: Promise.resolve({}) }),
  };
});

import { GET } from '@/app/api/deleted/route';

describe('GET /api/deleted', () => {
  it('an unknown type is invalid_query naming the type parameter', async () => {
    const res = await GET(new Request('http://localhost/api/deleted?type=bogus'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error:
        'Invalid type parameter. Must be one of: people, groups, relationships, relationshipTypes, importantDates',
      code: 'invalid_query',
      params: { param: 'type' },
    });
  });
});
