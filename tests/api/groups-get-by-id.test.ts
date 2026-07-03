import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  groupFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    group: {
      findUnique: mocks.groupFindUnique,
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

vi.mock('../../lib/carddav/group-sync', () => ({
  syncGroupMembersToCardDav: vi.fn(() => Promise.resolve()),
}));

import { GET } from '../../app/api/groups/[id]/route';

describe('Groups GET by ID API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/groups/[id]', () => {
    it('should return 404 when group not found', async () => {
      mocks.groupFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/groups/group-1');
      const context = { params: Promise.resolve({ id: 'group-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Group not found');
    });

    it('should return group with people', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Friends',
        color: '#FF5733',
        people: [
          { person: { id: 'person-1', name: 'Alice', deletedAt: null } },
        ],
      };
      mocks.groupFindUnique.mockResolvedValue(mockGroup);

      const request = new Request('http://localhost/api/groups/group-1');
      const context = { params: Promise.resolve({ id: 'group-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.group).toEqual(mockGroup);
    });

    it('should exclude soft-deleted people from group members', async () => {
      mocks.groupFindUnique.mockResolvedValue({
        id: 'group-1',
        name: 'Friends',
        people: [],
      });

      const request = new Request('http://localhost/api/groups/group-1');
      const context = { params: Promise.resolve({ id: 'group-1' }) };
      await GET(request, context);

      expect(mocks.groupFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            people: expect.objectContaining({
              where: { person: { deletedAt: null } },
            }),
          }),
        })
      );
    });

    it('should scope query to current user and non-deleted groups', async () => {
      mocks.groupFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/groups/group-1');
      const context = { params: Promise.resolve({ id: 'group-1' }) };
      await GET(request, context);

      expect(mocks.groupFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'group-1',
            userId: 'user-123',
            deletedAt: null,
          }),
        })
      );
    });
  });
});
