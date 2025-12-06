import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  groupFindUnique: vi.fn(),
  groupFindMany: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCreate: vi.fn(),
  groupUpdate: vi.fn(),
  groupDelete: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    group: {
      findUnique: mocks.groupFindUnique,
      findMany: mocks.groupFindMany,
      findFirst: mocks.groupFindFirst,
      create: mocks.groupCreate,
      update: mocks.groupUpdate,
      delete: mocks.groupDelete,
    },
  },
}));

// Mock auth
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Import after mocking
import { GET, POST } from '../../app/api/groups/route';

describe('Groups API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/groups', () => {
    it('should return list of groups for authenticated user', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Friends', color: '#FF5733', people: [] },
        { id: 'group-2', name: 'Family', color: '#33FF57', people: [] },
      ];

      mocks.groupFindMany.mockResolvedValue(mockGroups);

      const request = new Request('http://localhost/api/groups');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.groups).toEqual(mockGroups);
    });

    it('should only return groups for current user', async () => {
      mocks.groupFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/groups');
      await GET(request);

      expect(mocks.groupFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        })
      );
    });

    it('should order groups by name', async () => {
      mocks.groupFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/groups');
      await GET(request);

      expect(mocks.groupFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should include people in groups', async () => {
      mocks.groupFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/groups');
      await GET(request);

      expect(mocks.groupFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            people: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('POST /api/groups', () => {
    it('should create a group with valid data', async () => {
      const newGroup = {
        id: 'group-new',
        name: 'Work',
        description: 'Work colleagues',
        color: '#0000FF',
      };

      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue(newGroup);

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Work',
          description: 'Work colleagues',
          color: '#0000FF',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.group).toEqual(newGroup);
    });

    it('should require name field', async () => {
      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ description: 'No name' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should reject duplicate group names', async () => {
      mocks.groupFindFirst.mockResolvedValue({ id: 'existing', name: 'Friends' });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Friends' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already exists');
    });

    it('should check for duplicate names case-insensitively', async () => {
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({ id: 'new', name: 'friends' });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'friends' }),
        headers: { 'content-type': 'application/json' },
      });

      await POST(request);

      expect(mocks.groupFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({
              mode: 'insensitive',
            }),
          }),
        })
      );
    });

    it('should allow optional description', async () => {
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({ id: 'new', name: 'Test' });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mocks.groupCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: null,
          }),
        })
      );
    });

    it('should allow optional color', async () => {
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({ id: 'new', name: 'Test' });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mocks.groupCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            color: null,
          }),
        })
      );
    });

    it('should associate group with current user', async () => {
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({ id: 'new', name: 'Test' });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'content-type': 'application/json' },
      });

      await POST(request);

      expect(mocks.groupCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-123',
          }),
        })
      );
    });
  });
});
