import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  relationshipFindUnique: vi.fn(),
  relationshipFindFirst: vi.fn(),
  relationshipCreate: vi.fn(),
  relationshipUpdate: vi.fn(),
  relationshipDelete: vi.fn(),
  personFindUnique: vi.fn(),
  relationshipTypeFindFirst: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    relationship: {
      findUnique: mocks.relationshipFindUnique,
      findFirst: mocks.relationshipFindFirst,
      create: mocks.relationshipCreate,
      update: mocks.relationshipUpdate,
      delete: mocks.relationshipDelete,
    },
    person: {
      findUnique: mocks.personFindUnique,
    },
    relationshipType: {
      findFirst: mocks.relationshipTypeFindFirst,
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
import { POST } from '../../app/api/relationships/route';
import { PUT, DELETE } from '../../app/api/relationships/[id]/route';

describe('Relationships API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/relationships', () => {
    it('should create a relationship', async () => {
      const person = { id: 'person-1', name: 'John', userId: 'user-123' };
      const relatedPerson = { id: 'person-2', name: 'Jane', userId: 'user-123' };
      const relType = { id: 'rel-type-1', name: 'Friend', inverseId: 'rel-type-1' };
      const newRelationship = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        relationshipTypeId: 'rel-type-1',
      };

      mocks.relationshipFindFirst.mockResolvedValue(null);
      mocks.personFindUnique.mockResolvedValueOnce(person);
      mocks.personFindUnique.mockResolvedValueOnce(relatedPerson);
      mocks.relationshipTypeFindFirst.mockResolvedValue(relType);
      mocks.relationshipCreate.mockResolvedValue(newRelationship);

      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.relationship).toEqual(newRelationship);
    });

    it('should prevent self-relationships', async () => {
      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-1',
          relationshipTypeId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('same person');
    });

    it('should prevent duplicate relationships', async () => {
      mocks.relationshipFindFirst.mockResolvedValue({
        id: 'existing-rel',
        personId: 'person-1',
        relatedPersonId: 'person-2',
      });

      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('already exists');
    });

    it('should return 404 when person not found', async () => {
      mocks.relationshipFindFirst.mockResolvedValue(null);
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'non-existent',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should require relationship type', async () => {
      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
    });

    it('should create inverse relationship when type has inverseId', async () => {
      const person = { id: 'person-1', name: 'John', userId: 'user-123' };
      const relatedPerson = { id: 'person-2', name: 'Jane', userId: 'user-123' };
      const relType = { id: 'parent', name: 'Parent', inverseId: 'child' };

      mocks.relationshipFindFirst
        .mockResolvedValueOnce(null) // Check for duplicate
        .mockResolvedValueOnce(null); // Check for existing inverse
      mocks.personFindUnique.mockResolvedValueOnce(person);
      mocks.personFindUnique.mockResolvedValueOnce(relatedPerson);
      mocks.relationshipTypeFindFirst.mockResolvedValue(relType);
      mocks.relationshipCreate.mockResolvedValue({
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
      });

      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'parent',
        }),
        headers: { 'content-type': 'application/json' },
      });

      await POST(request);

      // Should create both the primary and inverse relationship
      expect(mocks.relationshipCreate).toHaveBeenCalledTimes(2);
    });
  });

  describe('PUT /api/relationships/[id]', () => {
    it('should update a relationship', async () => {
      const existing = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', userId: 'user-123' },
        relatedPerson: { id: 'person-2', userId: 'user-123' },
      };
      const relType = { id: 'new-type', inverseId: 'new-type-inverse' };
      const updatedRel = { ...existing, relationshipTypeId: 'new-type' };

      mocks.relationshipFindUnique.mockResolvedValue(existing);
      mocks.relationshipTypeFindFirst.mockResolvedValue(relType);
      mocks.relationshipUpdate.mockResolvedValue(updatedRel);
      mocks.relationshipFindFirst.mockResolvedValue({
        id: 'inverse-rel',
        personId: 'person-2',
        relatedPersonId: 'person-1',
      });

      const request = new Request('http://localhost/api/relationships/rel-1', {
        method: 'PUT',
        body: JSON.stringify({ relationshipTypeId: 'new-type' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'rel-1' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.relationship).toEqual(updatedRel);
    });

    it('should return 404 for non-existent relationship', async () => {
      mocks.relationshipFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationships/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ relationshipTypeId: 'new-type' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should require relationship type', async () => {
      const existing = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', userId: 'user-123' },
        relatedPerson: { id: 'person-2', userId: 'user-123' },
      };

      mocks.relationshipFindUnique.mockResolvedValue(existing);

      const request = new Request('http://localhost/api/relationships/rel-1', {
        method: 'PUT',
        body: JSON.stringify({ notes: 'Just notes, no type' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'rel-1' }) };

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
    });

    it('should return 401 when relationship belongs to another user', async () => {
      const existing = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', userId: 'other-user' },
        relatedPerson: { id: 'person-2', userId: 'other-user' },
      };

      mocks.relationshipFindUnique.mockResolvedValue(existing);

      const request = new Request('http://localhost/api/relationships/rel-1', {
        method: 'PUT',
        body: JSON.stringify({ relationshipTypeId: 'new-type' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'rel-1' }) };

      const response = await PUT(request, context);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/relationships/[id]', () => {
    it('should delete a relationship', async () => {
      const existing = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', userId: 'user-123' },
      };

      mocks.relationshipFindUnique.mockResolvedValue(existing);
      mocks.relationshipDelete.mockResolvedValue(existing);
      mocks.relationshipFindFirst.mockResolvedValue({
        id: 'inverse-rel',
        personId: 'person-2',
        relatedPersonId: 'person-1',
      });

      const request = new Request('http://localhost/api/relationships/rel-1', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'rel-1' }) };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toContain('deleted');
    });

    it('should also delete inverse relationship', async () => {
      const existing = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', userId: 'user-123' },
      };
      const inverse = {
        id: 'inverse-rel',
        personId: 'person-2',
        relatedPersonId: 'person-1',
      };

      mocks.relationshipFindUnique.mockResolvedValue(existing);
      mocks.relationshipDelete.mockResolvedValue(existing);
      mocks.relationshipFindFirst.mockResolvedValue(inverse);

      const request = new Request('http://localhost/api/relationships/rel-1', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'rel-1' }) };

      await DELETE(request, context);

      // Should delete both primary and inverse
      expect(mocks.relationshipDelete).toHaveBeenCalledTimes(2);
      expect(mocks.relationshipDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rel-1' } })
      );
      expect(mocks.relationshipDelete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inverse-rel' } })
      );
    });

    it('should return 404 for non-existent relationship', async () => {
      mocks.relationshipFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationships/non-existent', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };

      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should return 401 when relationship belongs to another user', async () => {
      const existing = {
        id: 'rel-1',
        personId: 'person-1',
        relatedPersonId: 'person-2',
        person: { id: 'person-1', userId: 'other-user' },
      };

      mocks.relationshipFindUnique.mockResolvedValue(existing);

      const request = new Request('http://localhost/api/relationships/rel-1', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'rel-1' }) };

      const response = await DELETE(request, context);

      expect(response.status).toBe(401);
    });
  });
});
