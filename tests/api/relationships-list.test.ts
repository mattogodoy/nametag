import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  relationshipFindMany: vi.fn(),
  relationshipFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    relationship: {
      findMany: mocks.relationshipFindMany,
      findFirst: mocks.relationshipFindFirst,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { GET } from '../../app/api/relationships/route';

describe('GET /api/relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all relationships for the authenticated user', async () => {
    const mockRelationships = [
      {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', name: 'Alice', surname: null, nickname: null },
        relatedPerson: { id: 'person-2', name: 'Bob', surname: null, nickname: null },
        relationshipType: { id: 'type-1', name: 'FRIEND', label: 'Friend', color: '#10B981' },
      },
    ];

    mocks.relationshipFindMany.mockResolvedValue(mockRelationships);

    const request = new Request('http://localhost/api/relationships');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.relationships).toEqual(mockRelationships);
  });

  it('should filter out soft-deleted persons', async () => {
    mocks.relationshipFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/relationships');
    await GET(request);

    expect(mocks.relationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          person: { userId: 'user-123', deletedAt: null },
          relatedPerson: { deletedAt: null },
        }),
      })
    );
  });

  it('should filter out soft-deleted relationship types', async () => {
    mocks.relationshipFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/relationships');
    await GET(request);

    expect(mocks.relationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { relationshipTypeId: null },
            { relationshipType: { deletedAt: null } },
          ],
        }),
      })
    );
  });

  it('should order by createdAt descending', async () => {
    mocks.relationshipFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost/api/relationships');
    await GET(request);

    expect(mocks.relationshipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    );
  });
});
