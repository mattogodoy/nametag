/**
 * Regression tests for soft-delete filtering.
 *
 * These tests verify that `deletedAt: null` is included in Prisma queries
 * for the highest-risk read paths. If a future change accidentally removes
 * a soft-delete filter, these tests will catch it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock factories (hoisted so vi.mock can reference them)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  // Person
  personFindMany: vi.fn(),
  personFindFirst: vi.fn(),
  personCount: vi.fn(),
  personFindUnique: vi.fn(),
  // Group
  groupFindMany: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCount: vi.fn(),
  groupCreate: vi.fn(),
  // Relationship
  relationshipFindFirst: vi.fn(),
  relationshipCreate: vi.fn(),
  // RelationshipType
  relationshipTypeFindMany: vi.fn(),
  relationshipTypeFindFirst: vi.fn(),
  relationshipTypeCreate: vi.fn(),
  relationshipTypeUpdate: vi.fn(),
  // User
  userFindUnique: vi.fn(),
  // Upcoming events helper
  getUpcomingEvents: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock Prisma — only the models/methods exercised by the routes under test
// ---------------------------------------------------------------------------
vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
      findFirst: mocks.personFindFirst,
      findUnique: mocks.personFindUnique,
      count: mocks.personCount,
    },
    group: {
      findMany: mocks.groupFindMany,
      findFirst: mocks.groupFindFirst,
      count: mocks.groupCount,
      create: mocks.groupCreate,
    },
    relationship: {
      findFirst: mocks.relationshipFindFirst,
      create: mocks.relationshipCreate,
    },
    relationshipType: {
      findMany: mocks.relationshipTypeFindMany,
      findFirst: mocks.relationshipTypeFindFirst,
      create: mocks.relationshipTypeCreate,
      update: mocks.relationshipTypeUpdate,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock auth — always returns a valid session with user-123
// ---------------------------------------------------------------------------
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// ---------------------------------------------------------------------------
// Mock billing — allow everything
// ---------------------------------------------------------------------------
vi.mock('../../lib/billing', () => ({
  canCreateResource: vi.fn(() =>
    Promise.resolve({ allowed: true, current: 0, limit: 50, tier: 'FREE', isUnlimited: false })
  ),
  canEnableReminder: vi.fn(() =>
    Promise.resolve({ allowed: true, current: 0, limit: 5, isUnlimited: false })
  ),
  getUserUsage: vi.fn(() =>
    Promise.resolve({ people: 0, groups: 0, reminders: 0 })
  ),
}));

// ---------------------------------------------------------------------------
// Mock features — needed for import/validate route (SaaS mode)
// ---------------------------------------------------------------------------
vi.mock('../../lib/features', () => ({
  isSaasMode: vi.fn(() => true),
  isFeatureEnabled: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Mock upcoming-events helper used by dashboard stats
// ---------------------------------------------------------------------------
vi.mock('../../lib/upcoming-events', () => ({
  getUpcomingEvents: (...args: unknown[]) => mocks.getUpcomingEvents(...args),
}));

// ---------------------------------------------------------------------------
// Import route handlers *after* all mocks are in place
// ---------------------------------------------------------------------------
import { GET as getPeople } from '../../app/api/people/route';
import { GET as getPerson } from '../../app/api/people/[id]/route';
import { GET as getGroups, POST as postGroup } from '../../app/api/groups/route';
import { GET as getRelationshipTypes, POST as postRelationshipType } from '../../app/api/relationship-types/route';
import { POST as postRelationship } from '../../app/api/relationships/route';
import { GET as searchPeople } from '../../app/api/people/search/route';
import { GET as getDashboardStats } from '../../app/api/dashboard/stats/route';
import { GET as exportData } from '../../app/api/user/export/route';
import { POST as validateImport } from '../../app/api/user/import/validate/route';

// ===========================================================================
// Tests
// ===========================================================================
describe('Soft-delete filter regression tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. GET /api/people
  // -------------------------------------------------------------------------
  describe('GET /api/people', () => {
    it('should include deletedAt: null in person.findMany where clause', async () => {
      mocks.personFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/people');
      await getPeople(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should filter soft-deleted groups in nested groups include (issue #255)', async () => {
      mocks.personFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/people');
      await getPeople(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.include.groups).toHaveProperty('where');
      expect(callArg.include.groups.where).toEqual({ group: { deletedAt: null } });
    });
  });

  // -------------------------------------------------------------------------
  // 2. GET /api/groups
  // -------------------------------------------------------------------------
  describe('GET /api/groups', () => {
    it('should include deletedAt: null in group.findMany where clause', async () => {
      mocks.groupFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/groups');
      await getGroups(request);

      expect(mocks.groupFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.groupFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });

  // -------------------------------------------------------------------------
  // 3. GET /api/relationship-types
  // -------------------------------------------------------------------------
  describe('GET /api/relationship-types', () => {
    it('should include deletedAt: null in relationshipType.findMany where clause', async () => {
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/relationship-types');
      await getRelationshipTypes(request);

      expect(mocks.relationshipTypeFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.relationshipTypeFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });

  // -------------------------------------------------------------------------
  // 4. GET /api/people/search
  // -------------------------------------------------------------------------
  describe('GET /api/people/search', () => {
    it('should include deletedAt: null in person.findMany where clause', async () => {
      mocks.personFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/people/search?q=John');
      await searchPeople(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should not query at all when search query is empty', async () => {
      const request = new Request('http://localhost/api/people/search?q=');
      const response = await searchPeople(request);
      const body = await response.json();

      expect(mocks.personFindMany).not.toHaveBeenCalled();
      expect(body.people).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // 5. GET /api/dashboard/stats
  // -------------------------------------------------------------------------
  describe('GET /api/dashboard/stats', () => {
    beforeEach(() => {
      mocks.getUpcomingEvents.mockResolvedValue([]);
    });

    it('should include deletedAt: null in person.count where clause', async () => {
      mocks.personCount.mockResolvedValue(0);
      mocks.groupCount.mockResolvedValue(0);

      const request = new Request('http://localhost/api/dashboard/stats');
      await getDashboardStats(request);

      expect(mocks.personCount).toHaveBeenCalledTimes(1);
      const callArg = mocks.personCount.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in group.count where clause', async () => {
      mocks.personCount.mockResolvedValue(0);
      mocks.groupCount.mockResolvedValue(0);

      const request = new Request('http://localhost/api/dashboard/stats');
      await getDashboardStats(request);

      expect(mocks.groupCount).toHaveBeenCalledTimes(1);
      const callArg = mocks.groupCount.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });

  // -------------------------------------------------------------------------
  // 6. GET /api/user/export
  // -------------------------------------------------------------------------
  describe('GET /api/user/export', () => {
    beforeEach(() => {
      mocks.userFindUnique.mockResolvedValue({
        email: 'test@example.com',
        name: 'Test',
        theme: 'LIGHT',
        dateFormat: 'MDY',
        createdAt: new Date(),
      });
    });

    it('should include deletedAt: null in person.findMany where clause', async () => {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.groupFindMany.mockResolvedValue([]);
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export');
      await exportData(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in group.findMany where clause', async () => {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.groupFindMany.mockResolvedValue([]);
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export');
      await exportData(request);

      expect(mocks.groupFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.groupFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in relationshipType.findMany where clause', async () => {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.groupFindMany.mockResolvedValue([]);
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export');
      await exportData(request);

      expect(mocks.relationshipTypeFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.relationshipTypeFindMany.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in nested relationshipsFrom include', async () => {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.groupFindMany.mockResolvedValue([]);
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export');
      await exportData(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.include.relationshipsFrom).toHaveProperty('where');
      expect(callArg.include.relationshipsFrom.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in nested importantDates include', async () => {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.groupFindMany.mockResolvedValue([]);
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export');
      await exportData(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.include.importantDates).toHaveProperty('where');
      expect(callArg.include.importantDates.where).toHaveProperty('deletedAt', null);
    });

    it('should filter soft-deleted groups in nested groups include (issue #255)', async () => {
      mocks.personFindMany.mockResolvedValue([]);
      mocks.groupFindMany.mockResolvedValue([]);
      mocks.relationshipTypeFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost/api/user/export');
      await exportData(request);

      expect(mocks.personFindMany).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindMany.mock.calls[0][0];
      expect(callArg.include.groups).toHaveProperty('where');
      expect(callArg.include.groups.where).toEqual({ group: { deletedAt: null } });
    });
  });

  // -------------------------------------------------------------------------
  // 7. POST /api/relationships
  // -------------------------------------------------------------------------
  describe('POST /api/relationships', () => {
    it('should include deletedAt: null in relationship.findFirst duplicate check', async () => {
      // Return an existing relationship to stop early (we only care about the findFirst call)
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

      await postRelationship(request);

      expect(mocks.relationshipFindFirst).toHaveBeenCalledTimes(1);
      const callArg = mocks.relationshipFindFirst.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in person.findUnique for both people', async () => {
      // No duplicate found
      mocks.relationshipFindFirst.mockResolvedValue(null);
      // Return null for person to stop early (we care about the findUnique call args)
      mocks.personFindUnique.mockResolvedValue(null);
      mocks.relationshipTypeFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      await postRelationship(request);

      // person.findUnique is called for both personId and relatedPersonId
      expect(mocks.personFindUnique).toHaveBeenCalledTimes(2);
      const firstCallArg = mocks.personFindUnique.mock.calls[0][0];
      const secondCallArg = mocks.personFindUnique.mock.calls[1][0];
      expect(firstCallArg.where).toHaveProperty('deletedAt', null);
      expect(secondCallArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in relationshipType.findFirst', async () => {
      mocks.relationshipFindFirst.mockResolvedValue(null);
      // Return valid people so we reach the relationshipType check
      mocks.personFindUnique.mockResolvedValueOnce({ id: 'person-1', userId: 'user-123' });
      mocks.personFindUnique.mockResolvedValueOnce({ id: 'person-2', userId: 'user-123' });
      // Return null for relationship type to stop early
      mocks.relationshipTypeFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      await postRelationship(request);

      expect(mocks.relationshipTypeFindFirst).toHaveBeenCalledTimes(1);
      const callArg = mocks.relationshipTypeFindFirst.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });

  // -------------------------------------------------------------------------
  // 8. GET /api/people/[id]
  // -------------------------------------------------------------------------
  describe('GET /api/people/[id]', () => {
    it('should scope person.findUnique to the authenticated user', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/person-1');
      const context = { params: Promise.resolve({ id: 'person-1' }) };
      await getPerson(request, context);

      expect(mocks.personFindUnique).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindUnique.mock.calls[0][0];
      // Ownership scoping is required; soft-delete filtering is handled by the
      // Prisma client extension rather than an explicit deletedAt: null clause.
      expect(callArg.where).toHaveProperty('id', 'person-1');
      expect(callArg.where).toHaveProperty('userId', 'user-123');
    });
  });

  // -------------------------------------------------------------------------
  // 9. POST /api/user/import/validate
  // -------------------------------------------------------------------------
  describe('POST /api/user/import/validate', () => {
    it('should include deletedAt: null in person.findFirst dedup check', async () => {
      // Return null so the person is counted as new
      mocks.personFindFirst.mockResolvedValue(null);
      mocks.groupFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/user/import/validate', {
        method: 'POST',
        body: JSON.stringify({
          version: '1.0',
          exportDate: new Date().toISOString(),
          people: [{
            id: 'person-1',
            name: 'John',
            surname: 'Doe',
            groups: [],
            relationships: [],
          }],
          groups: [],
        }),
        headers: { 'content-type': 'application/json' },
      });

      await validateImport(request);

      expect(mocks.personFindFirst).toHaveBeenCalledTimes(1);
      const callArg = mocks.personFindFirst.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });

    it('should include deletedAt: null in group.findFirst dedup check', async () => {
      mocks.personFindFirst.mockResolvedValue(null);
      mocks.groupFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/user/import/validate', {
        method: 'POST',
        body: JSON.stringify({
          version: '1.0',
          exportDate: new Date().toISOString(),
          people: [],
          groups: [{ id: 'group-1', name: 'Family' }],
        }),
        headers: { 'content-type': 'application/json' },
      });

      await validateImport(request);

      expect(mocks.groupFindFirst).toHaveBeenCalledTimes(1);
      const callArg = mocks.groupFindFirst.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });

  // -------------------------------------------------------------------------
  // 10. POST /api/groups
  // -------------------------------------------------------------------------
  describe('POST /api/groups', () => {
    it('should include deletedAt: null in group.findFirst duplicate name check', async () => {
      mocks.groupFindFirst.mockResolvedValue(null);
      mocks.groupCreate.mockResolvedValue({ id: 'new-group', name: 'Test', people: [] });

      const request = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'content-type': 'application/json' },
      });

      await postGroup(request);

      expect(mocks.groupFindFirst).toHaveBeenCalledTimes(1);
      const callArg = mocks.groupFindFirst.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });

  // -------------------------------------------------------------------------
  // 11. POST /api/relationship-types
  // -------------------------------------------------------------------------
  describe('POST /api/relationship-types', () => {
    it('should include deletedAt: null in relationshipType.findFirst duplicate name check', async () => {
      mocks.relationshipTypeFindFirst.mockResolvedValue(null);
      mocks.relationshipTypeCreate.mockResolvedValue({
        id: 'new-type',
        name: 'MENTOR',
        label: 'Mentor',
        userId: 'user-123',
      });

      const request = new Request('http://localhost/api/relationship-types', {
        method: 'POST',
        body: JSON.stringify({
          name: 'MENTOR',
          label: 'Mentor',
        }),
        headers: { 'content-type': 'application/json' },
      });

      await postRelationshipType(request);

      expect(mocks.relationshipTypeFindFirst).toHaveBeenCalledTimes(1);
      const callArg = mocks.relationshipTypeFindFirst.mock.calls[0][0];
      expect(callArg.where).toHaveProperty('deletedAt', null);
    });
  });
});
