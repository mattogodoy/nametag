import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  personFindFirst: vi.fn(),
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  personUpdateMany: vi.fn(),
  personDelete: vi.fn(),
  personDeleteMany: vi.fn(),
  relationshipTypeFindUnique: vi.fn(),
  relationshipCreate: vi.fn(),
  importantDateCount: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      findMany: mocks.personFindMany,
      findFirst: mocks.personFindFirst,
      create: mocks.personCreate,
      update: mocks.personUpdate,
      updateMany: mocks.personUpdateMany,
      delete: mocks.personDelete,
      deleteMany: mocks.personDeleteMany,
    },
    relationshipType: {
      findUnique: mocks.relationshipTypeFindUnique,
    },
    relationship: {
      create: mocks.relationshipCreate,
    },
    importantDate: {
      count: mocks.importantDateCount,
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

// Mock billing
vi.mock('../../lib/billing', () => ({
  canCreateResource: vi.fn(() => Promise.resolve({ allowed: true, current: 0, limit: 50, tier: 'FREE', isUnlimited: false })),
  canEnableReminder: vi.fn(() => Promise.resolve({ allowed: true, current: 0, limit: 5, isUnlimited: false })),
  getUserUsage: vi.fn(() => Promise.resolve({ people: 0, groups: 0, reminders: 0 })),
}));

// Import after mocking
import { GET, POST } from '../../app/api/people/route';
import { GET as getPerson, PUT, DELETE } from '../../app/api/people/[id]/route';

describe('People API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/people', () => {
    it('should return list of people for authenticated user', async () => {
      const mockPeople = [
        { id: 'person-1', name: 'John', surname: 'Doe', groups: [] },
        { id: 'person-2', name: 'Jane', surname: 'Smith', groups: [] },
      ];

      mocks.personFindMany.mockResolvedValue(mockPeople);

      const request = new Request('http://localhost/api/people');
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.people).toEqual(mockPeople);
      expect(mocks.personFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123' },
        })
      );
    });

    it('should order people by name ascending', async () => {
      mocks.personFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/people');
      await GET(request);

      expect(mocks.personFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('should include relationships and groups', async () => {
      mocks.personFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/people');
      await GET(request);

      expect(mocks.personFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            relationshipToUser: true,
            groups: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('POST /api/people', () => {
    it('should create a person with valid data', async () => {
      const newPerson = {
        id: 'person-new',
        name: 'New Person',
        surname: null,
        groups: [],
      };

      mocks.personCreate.mockResolvedValue(newPerson);

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.person).toEqual(newPerson);
    });

    it('should require name field', async () => {
      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('should require relationship for direct connections', async () => {
      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Person' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Relationship');
    });

    it('should allow person connected through another person', async () => {
      const basePerson = { id: 'base-person', name: 'Base', userId: 'user-123' };
      const newPerson = { id: 'person-new', name: 'New Person', groups: [] };
      const relType = { id: 'rel-type-1', inverseId: 'rel-type-2' };

      mocks.personFindUnique.mockResolvedValue(basePerson);
      mocks.personCreate.mockResolvedValue(newPerson);
      mocks.relationshipTypeFindUnique.mockResolvedValue(relType);
      mocks.relationshipCreate.mockResolvedValue({});

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          connectedThroughId: 'base-person',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mocks.relationshipCreate).toHaveBeenCalled();
    });

    it('should validate base person exists', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'New Person',
          connectedThroughId: 'non-existent',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });
  });

  describe('GET /api/people/[id]', () => {
    it('should return a single person', async () => {
      const person = {
        id: 'person-1',
        name: 'John',
        surname: 'Doe',
        userId: 'user-123',
        groups: [],
        relationshipsFrom: [],
      };

      mocks.personFindUnique.mockResolvedValue(person);

      const request = new Request('http://localhost/api/people/person-1');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await getPerson(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.person).toEqual(person);
    });

    it('should return 404 for non-existent person', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/non-existent');
      const context = { params: Promise.resolve({ id: 'non-existent' }) };
      const response = await getPerson(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should only return person belonging to user', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/other-user-person');
      const context = { params: Promise.resolve({ id: 'other-user-person' }) };
      await getPerson(request, context);

      expect(mocks.personFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'other-user-person', userId: 'user-123' },
        })
      );
    });
  });

  describe('PUT /api/people/[id]', () => {
    it('should update a person', async () => {
      const existingPerson = { id: 'person-1', name: 'John', userId: 'user-123', contactReminderEnabled: false };
      const updatedPerson = { id: 'person-1', name: 'John Updated', groups: [] };

      mocks.personFindUnique.mockResolvedValue(existingPerson);
      mocks.importantDateCount.mockResolvedValue(0);
      mocks.personUpdate.mockResolvedValue(updatedPerson);

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'John Updated' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.person).toEqual(updatedPerson);
    });

    it('should return 404 for non-existent person', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(404);
    });

    it('should validate update data', async () => {
      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({ name: '' }), // Empty name should fail
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(400);
    });

    it('should update groups', async () => {
      const existingPerson = { id: 'person-1', name: 'John', userId: 'user-123', contactReminderEnabled: false };
      const updatedPerson = { id: 'person-1', name: 'John', groups: [] };

      mocks.personFindUnique.mockResolvedValue(existingPerson);
      mocks.importantDateCount.mockResolvedValue(0);
      mocks.personUpdate.mockResolvedValue(updatedPerson);

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'John',
          groupIds: ['group-1', 'group-2'],
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      await PUT(request, context);

      expect(mocks.personUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            groups: expect.objectContaining({
              deleteMany: {},
              create: expect.any(Array),
            }),
          }),
        })
      );
    });
  });

  describe('DELETE /api/people/[id]', () => {
    it('should soft delete a person (set deletedAt)', async () => {
      const existingPerson = { id: 'person-1', name: 'John', userId: 'user-123' };

      mocks.personFindUnique.mockResolvedValue(existingPerson);
      mocks.personUpdate.mockResolvedValue({ ...existingPerson, deletedAt: new Date() });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.message).toContain('deleted');
      // Verify soft delete (update with deletedAt) instead of hard delete
      expect(mocks.personUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'person-1' },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return 404 for non-existent person', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/non-existent', {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'non-existent' }) };
      const response = await DELETE(request, context);

      expect(response.status).toBe(404);
    });

    it('should soft delete orphans when requested', async () => {
      const existingPerson = { id: 'person-1', name: 'John', userId: 'user-123' };

      mocks.personFindUnique.mockResolvedValue(existingPerson);
      mocks.personUpdate.mockResolvedValue({ ...existingPerson, deletedAt: new Date() });
      mocks.personUpdateMany.mockResolvedValue({ count: 2 });

      const request = new Request('http://localhost/api/people/person-1', {
        method: 'DELETE',
        body: JSON.stringify({
          deleteOrphans: true,
          orphanIds: ['orphan-1', 'orphan-2'],
        }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      await DELETE(request, context);

      // Verify orphans are soft deleted with updateMany
      expect(mocks.personUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['orphan-1', 'orphan-2'] },
            userId: 'user-123',
          }),
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );
    });
  });
});
