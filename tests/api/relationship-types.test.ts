import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  relationshipTypeFindMany: vi.fn(),
  relationshipTypeFindFirst: vi.fn(),
  relationshipTypeCreate: vi.fn(),
  relationshipTypeUpdate: vi.fn(),
  relationshipTypeDelete: vi.fn(),
  relationshipCount: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    relationshipType: {
      findMany: mocks.relationshipTypeFindMany,
      findFirst: mocks.relationshipTypeFindFirst,
      create: mocks.relationshipTypeCreate,
      update: mocks.relationshipTypeUpdate,
      delete: mocks.relationshipTypeDelete,
    },
    relationship: {
      count: mocks.relationshipCount,
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
import { GET, POST } from '../../app/api/relationship-types/route';
import {
  GET as GET_BY_ID,
  PUT,
  DELETE,
} from '../../app/api/relationship-types/[id]/route';

describe('Relationship Types API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/relationship-types', () => {
    it('should return all relationship types', async () => {
      const types = [
        { id: 'type-1', name: 'FRIEND', label: 'Friend', isDefault: true },
        { id: 'type-2', name: 'COLLEAGUE', label: 'Colleague', isDefault: false, userId: 'user-123' },
      ];
      mocks.relationshipTypeFindMany.mockResolvedValue(types);

      const request = new Request('http://localhost/api/relationship-types');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.relationshipTypes).toEqual(types);
    });
  });

  describe('POST /api/relationship-types', () => {
    it('should create a relationship type', async () => {
      const newType = {
        id: 'new-type',
        name: 'MENTOR',
        label: 'Mentor',
        color: '#FF0000',
        userId: 'user-123',
        isDefault: false,
      };

      mocks.relationshipTypeFindFirst.mockResolvedValue(null);
      mocks.relationshipTypeCreate.mockResolvedValue(newType);

      const request = new Request('http://localhost/api/relationship-types', {
        method: 'POST',
        body: JSON.stringify({
          name: 'MENTOR',
          label: 'Mentor',
          color: '#FF0000',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.relationshipType).toEqual(newType);
    });

    it('should create a symmetric relationship type (points to itself)', async () => {
      const createdType = {
        id: 'friend-type',
        name: 'FRIEND',
        label: 'Friend',
        color: '#10B981',
        userId: 'user-123',
        isDefault: false,
      };

      const updatedType = {
        ...createdType,
        inverseId: 'friend-type',
        inverse: {
          id: 'friend-type',
          name: 'FRIEND',
          label: 'Friend',
        },
      };

      mocks.relationshipTypeFindFirst.mockResolvedValue(null);
      mocks.relationshipTypeCreate.mockResolvedValue(createdType);
      mocks.relationshipTypeUpdate.mockResolvedValue(updatedType);

      const request = new Request('http://localhost/api/relationship-types', {
        method: 'POST',
        body: JSON.stringify({
          name: 'FRIEND',
          label: 'Friend',
          color: '#10B981',
          symmetric: true,
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.relationshipType.inverseId).toBe('friend-type');
      expect(body.relationshipType.inverse.id).toBe('friend-type');

      // Verify the type was created and then updated to point to itself
      expect(mocks.relationshipTypeCreate).toHaveBeenCalledTimes(1);
      expect(mocks.relationshipTypeUpdate).toHaveBeenCalledWith({
        where: { id: 'friend-type' },
        data: { inverseId: 'friend-type' },
        include: expect.any(Object),
      });
    });

    it('should prevent duplicate names', async () => {
      mocks.relationshipTypeFindFirst.mockResolvedValue({
        id: 'existing',
        name: 'FRIEND',
        label: 'Friend',
      });

      const request = new Request('http://localhost/api/relationship-types', {
        method: 'POST',
        body: JSON.stringify({
          name: 'FRIEND',
          label: 'Friend',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already exists');
    });

    it('should create inverse type when inverseLabel is provided', async () => {
      const mainType = {
        id: 'parent-type',
        name: 'PARENT',
        label: 'Parent',
        userId: 'user-123',
        isDefault: false,
        inverse: { id: 'child-type', name: 'CHILD', label: 'Child' },
      };

      const inverseType = {
        id: 'child-type',
        name: 'CHILD',
        label: 'Child',
        userId: 'user-123',
        isDefault: false,
      };

      mocks.relationshipTypeFindFirst
        .mockResolvedValueOnce(null) // Check for existing main type
        .mockResolvedValueOnce(null); // Check for existing inverse type
      mocks.relationshipTypeCreate
        .mockResolvedValueOnce(inverseType) // Create inverse first
        .mockResolvedValueOnce(mainType); // Create main type
      mocks.relationshipTypeUpdate.mockResolvedValue(inverseType);

      const request = new Request('http://localhost/api/relationship-types', {
        method: 'POST',
        body: JSON.stringify({
          name: 'PARENT',
          label: 'Parent',
          inverseLabel: 'Child',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mocks.relationshipTypeCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/relationship-types/[id]', () => {
    it('should return a relationship type by id', async () => {
      const type = {
        id: 'type-1',
        name: 'FRIEND',
        label: 'Friend',
        inverse: { id: 'type-1', name: 'FRIEND', label: 'Friend' },
      };
      mocks.relationshipTypeFindFirst.mockResolvedValue(type);

      const request = new Request('http://localhost/api/relationship-types/type-1');
      const context = { params: Promise.resolve({ id: 'type-1' }) };

      const response = await GET_BY_ID(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.relationshipType).toEqual(type);
    });

    it('should return 404 for non-existent type', async () => {
      mocks.relationshipTypeFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationship-types/non-existent');
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await GET_BY_ID(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });
  });

  describe('PUT /api/relationship-types/[id]', () => {
    it('should update a relationship type', async () => {
      const existing = {
        id: 'type-1',
        name: 'FRIEND',
        label: 'Friend',
        userId: 'user-123',
        isDefault: false,
      };
      const updated = {
        ...existing,
        label: 'Best Friend',
        color: '#FF0000',
      };

      mocks.relationshipTypeFindFirst
        .mockResolvedValueOnce(existing) // Find existing
        .mockResolvedValueOnce(null); // Check for duplicates
      mocks.relationshipTypeUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/relationship-types/type-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'FRIEND',
          label: 'Best Friend',
          color: '#FF0000',
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'type-1' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.relationshipType.label).toBe('Best Friend');
    });

    it('should update to symmetric relationship type', async () => {
      const existing = {
        id: 'type-1',
        name: 'FRIEND',
        label: 'Friend',
        userId: 'user-123',
        isDefault: false,
        inverseId: null,
      };
      const updated = {
        ...existing,
        inverseId: 'type-1',
        inverse: { id: 'type-1', name: 'FRIEND', label: 'Friend' },
      };

      mocks.relationshipTypeFindFirst
        .mockResolvedValueOnce(existing) // Find existing
        .mockResolvedValueOnce(null); // Check for duplicates
      mocks.relationshipTypeUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/relationship-types/type-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'FRIEND',
          label: 'Friend',
          symmetric: true,
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'type-1' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.relationshipType.inverseId).toBe('type-1');

      // Verify the update was called with inverseId pointing to itself
      expect(mocks.relationshipTypeUpdate).toHaveBeenCalledWith({
        where: { id: 'type-1' },
        data: expect.objectContaining({
          inverseId: 'type-1',
        }),
        include: expect.any(Object),
      });
    });

    it('should not allow modifying default types', async () => {
      const existing = {
        id: 'default-type',
        name: 'PARENT',
        label: 'Parent',
        isDefault: true,
      };

      mocks.relationshipTypeFindFirst.mockResolvedValue(existing);

      const request = new Request('http://localhost/api/relationship-types/default-type', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'PARENT',
          label: 'Parent Modified',
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'default-type' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('default');
    });

    it('should return 404 for non-existent type', async () => {
      mocks.relationshipTypeFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationship-types/non-existent', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'TEST',
          label: 'Test',
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });
  });

  describe('DELETE /api/relationship-types/[id]', () => {
    it('should delete a relationship type', async () => {
      const existing = {
        id: 'type-1',
        name: 'CUSTOM',
        label: 'Custom',
        userId: 'user-123',
        isDefault: false,
      };

      mocks.relationshipTypeFindFirst.mockResolvedValue(existing);
      mocks.relationshipCount.mockResolvedValue(0);
      mocks.relationshipTypeDelete.mockResolvedValue(existing);

      const request = new Request('http://localhost/api/relationship-types/type-1', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'type-1' }) };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should not allow deleting types in use', async () => {
      const existing = {
        id: 'type-1',
        name: 'CUSTOM',
        label: 'Custom',
        userId: 'user-123',
        isDefault: false,
      };

      mocks.relationshipTypeFindFirst.mockResolvedValue(existing);
      mocks.relationshipCount.mockResolvedValue(5);

      const request = new Request('http://localhost/api/relationship-types/type-1', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'type-1' }) };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('in use');
    });

    it('should return 404 for non-existent type', async () => {
      mocks.relationshipTypeFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationship-types/non-existent', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });
  });
});
