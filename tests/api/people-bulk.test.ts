import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  personUpdateMany: vi.fn(),
  personGroupCreateMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  groupFindMany: vi.fn(),
  cardDavMappingDeleteMany: vi.fn(),
  cardDavMappingFindMany: vi.fn(),
  relationshipTypeFindUnique: vi.fn(),
  deleteFromCardDav: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
      update: mocks.personUpdate,
      updateMany: mocks.personUpdateMany,
    },
    personGroup: {
      createMany: mocks.personGroupCreateMany,
      findMany: mocks.personGroupFindMany,
    },
    group: {
      findMany: mocks.groupFindMany,
    },
    cardDavMapping: {
      deleteMany: mocks.cardDavMappingDeleteMany,
      findMany: mocks.cardDavMappingFindMany,
    },
    relationshipType: {
      findUnique: mocks.relationshipTypeFindUnique,
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

vi.mock('../../lib/carddav/delete-contact', () => ({
  deleteFromCardDav: mocks.deleteFromCardDav,
}));

import { POST } from '../../app/api/people/bulk/route';

describe('Bulk Actions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('delete action', () => {
    it('should soft-delete specified people', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
        { id: 'p2', userId: 'user-123' },
      ]);
      mocks.personUpdateMany.mockResolvedValue({ count: 2 });
      mocks.cardDavMappingDeleteMany.mockResolvedValue({ count: 0 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          personIds: ['p1', 'p2'],
          deleteOrphans: false,
          deleteFromCardDav: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.affectedCount).toBe(2);
      expect(mocks.personUpdateMany).toHaveBeenCalled();
    });

    it('should also delete orphans when requested', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
      ]);
      mocks.personUpdateMany
        .mockResolvedValueOnce({ count: 1 })  // main delete
        .mockResolvedValueOnce({ count: 2 }); // orphan delete
      mocks.cardDavMappingDeleteMany.mockResolvedValue({ count: 0 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          personIds: ['p1'],
          deleteOrphans: true,
          orphanIds: ['orphan-1', 'orphan-2'],
          deleteFromCardDav: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.affectedCount).toBe(1);
      expect(mocks.personUpdateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('addToGroups action', () => {
    it('should add people to groups avoiding duplicates', async () => {
      mocks.groupFindMany.mockResolvedValue([
        { id: 'g1' },
        { id: 'g2' },
      ]);
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
        { id: 'p2', userId: 'user-123' },
      ]);
      mocks.personGroupFindMany.mockResolvedValue([
        { personId: 'p1', groupId: 'g1' },
      ]);
      mocks.personGroupCreateMany.mockResolvedValue({ count: 3 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addToGroups',
          personIds: ['p1', 'p2'],
          groupIds: ['g1', 'g2'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.affectedCount).toBe(2);
    });
  });

  describe('setRelationship action', () => {
    it('should set relationship type for all selected people', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
        { id: 'p2', userId: 'user-123' },
      ]);
      mocks.relationshipTypeFindUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'user-123',
      });
      mocks.personUpdateMany.mockResolvedValue({ count: 2 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setRelationship',
          personIds: ['p1', 'p2'],
          relationshipTypeId: 'rt1',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.affectedCount).toBe(2);
    });

    it('should reject invalid relationship type', async () => {
      mocks.relationshipTypeFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setRelationship',
          personIds: ['p1'],
          relationshipTypeId: 'invalid',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  it('should reject invalid action', async () => {
    const request = new Request('http://localhost/api/people/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid', personIds: ['p1'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
