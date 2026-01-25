import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  relationshipFindMany: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      findMany: mocks.personFindMany,
    },
    relationship: {
      findMany: mocks.relationshipFindMany,
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
import { GET } from '../../app/api/people/[id]/orphans/route';

describe('People Orphans API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/people/[id]/orphans', () => {
    it('should return 404 when person not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Person not found');
    });

    it('should detect orphans - person with no relationshipToUser and no other relationships', async () => {
      // 1. Person being deleted with their relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [{ id: 'rel-1', relatedPersonId: 'person-2' }],
        relationshipsTo: [],
      });

      // 2. Related people and their relationships
      mocks.personFindMany.mockResolvedValueOnce([
        {
          id: 'person-2',
          name: 'Jane',
          surname: 'Smith',
          nickname: null,
          relationshipToUser: null,
          relationshipsFrom: [],
          relationshipsTo: [{ id: 'rel-1', personId: 'person-1' }],
        },
      ]);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(1);
      expect(body.orphans[0]).toEqual({
        id: 'person-2',
        fullName: 'Jane Smith',
      });
    });

    it('should NOT detect as orphan - person with direct relationshipToUser', async () => {
      // 1. Person being deleted with their relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [{ id: 'rel-1', relatedPersonId: 'person-2' }],
        relationshipsTo: [],
      });

      // 2. Related people (NOT orphan because has relationshipToUser)
      mocks.personFindMany.mockResolvedValueOnce([
        {
          id: 'person-2',
          name: 'Jane',
          surname: 'Smith',
          nickname: null,
          relationshipToUser: { id: 'rel-type-1', label: 'Friend' },
          relationshipsFrom: [],
          relationshipsTo: [{ id: 'rel-1', personId: 'person-1' }],
        },
      ]);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(0);
    });

    it('should NOT detect as orphan - person has other relationships', async () => {
      // 1. Person being deleted with their relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [{ id: 'rel-1', relatedPersonId: 'person-2' }],
        relationshipsTo: [],
      });

      // 2. Related people (NOT orphan because has another relationship with person-3)
      mocks.personFindMany.mockResolvedValueOnce([
        {
          id: 'person-2',
          name: 'Jane',
          surname: 'Smith',
          nickname: null,
          relationshipToUser: null,
          relationshipsFrom: [
            { id: 'rel-2', relatedPersonId: 'person-3' }, // Another relationship
          ],
          relationshipsTo: [
            { id: 'rel-1', personId: 'person-1' },
          ],
        },
      ]);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(0);
    });

    it('should detect as orphan - person with soft-deleted relationshipToUser (the bug fix)', async () => {
      // 1. Person being deleted with their relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [{ id: 'rel-1', relatedPersonId: 'person-2' }],
        relationshipsTo: [],
      });

      // 2. Related people (SHOULD be orphan - relationshipToUser is null/soft-deleted)
      mocks.personFindMany.mockResolvedValueOnce([
        {
          id: 'person-2',
          name: 'Jane',
          surname: 'Smith',
          nickname: null,
          relationshipToUser: null, // Soft-deleted relation is null
          relationshipsFrom: [],
          relationshipsTo: [{ id: 'rel-1', personId: 'person-1' }],
        },
      ]);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(1);
      expect(body.orphans[0]).toEqual({
        id: 'person-2',
        fullName: 'Jane Smith',
      });
    });

    it('should detect multiple orphans', async () => {
      // 1. Person being deleted with their relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [
          { id: 'rel-1', relatedPersonId: 'person-2' },
          { id: 'rel-2', relatedPersonId: 'person-3' },
        ],
        relationshipsTo: [],
      });

      // 2. Related people (both should be orphans)
      mocks.personFindMany.mockResolvedValueOnce([
        {
          id: 'person-2',
          name: 'Jane',
          surname: 'Smith',
          nickname: null,
          relationshipToUser: null,
          relationshipsFrom: [],
          relationshipsTo: [{ id: 'rel-1', personId: 'person-1' }],
        },
        {
          id: 'person-3',
          name: 'Bob',
          surname: 'Johnson',
          nickname: 'Bobby',
          relationshipToUser: null,
          relationshipsFrom: [],
          relationshipsTo: [{ id: 'rel-2', personId: 'person-1' }],
        },
      ]);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(2);
      expect(body.orphans).toContainEqual({
        id: 'person-2',
        fullName: 'Jane Smith',
      });
      expect(body.orphans).toContainEqual({
        id: 'person-3',
        fullName: "Bob 'Bobby' Johnson",
      });
    });

    it('should return empty array when person has no relationships', async () => {
      // 1. Person being deleted with no relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [],
        relationshipsTo: [],
      });

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(0);
    });

    it('should use nickname in fullName if available', async () => {
      // 1. Person being deleted with their relationships
      mocks.personFindUnique.mockResolvedValueOnce({
        id: 'person-1',
        userId: 'user-123',
        name: 'John',
        surname: 'Doe',
        relationshipsFrom: [{ id: 'rel-1', relatedPersonId: 'person-2' }],
        relationshipsTo: [],
      });

      // 2. Related person with nickname
      mocks.personFindMany.mockResolvedValueOnce([
        {
          id: 'person-2',
          name: 'Jane',
          surname: 'Smith',
          nickname: 'Jenny',
          relationshipToUser: null,
          relationshipsFrom: [],
          relationshipsTo: [{ id: 'rel-1', personId: 'person-1' }],
        },
      ]);

      const request = new Request('http://localhost/api/people/person-1/orphans');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      const response = await GET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.orphans).toHaveLength(1);
      expect(body.orphans[0]).toEqual({
        id: 'person-2',
        fullName: "Jane 'Jenny' Smith",
      });
    });
  });
});
