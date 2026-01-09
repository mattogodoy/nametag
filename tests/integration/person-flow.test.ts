/**
 * Integration tests for person management flows.
 * These tests verify that multiple API operations work together correctly.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock data store to simulate database state across operations
const mockDataStore = {
  people: new Map<string, any>(),
  groups: new Map<string, any>(),
  personGroups: new Map<string, any>(),
  relationships: new Map<string, any>(),
  relationshipTypes: new Map<string, any>(),
};

// Reset the store before each test
function resetStore() {
  mockDataStore.people.clear();
  mockDataStore.groups.clear();
  mockDataStore.personGroups.clear();
  mockDataStore.relationships.clear();
  mockDataStore.relationshipTypes.clear();

  // Add relationship types for the test user
  mockDataStore.relationshipTypes.set('friend', {
    id: 'friend',
    name: 'Friend',
    inverseId: 'friend',
    userId: 'user-123',
  });
  mockDataStore.relationshipTypes.set('parent', {
    id: 'parent',
    name: 'Parent',
    inverseId: 'child',
    userId: 'user-123',
  });
  mockDataStore.relationshipTypes.set('child', {
    id: 'child',
    name: 'Child',
    inverseId: 'parent',
    userId: 'user-123',
  });
}

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // Person operations
  personFindUnique: vi.fn(),
  personFindMany: vi.fn(),
  personFindFirst: vi.fn(),
  personCreate: vi.fn(),
  personUpdate: vi.fn(),
  personDelete: vi.fn(),
  // Group operations
  groupFindUnique: vi.fn(),
  groupFindMany: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCreate: vi.fn(),
  groupUpdate: vi.fn(),
  groupDelete: vi.fn(),
  // Relationship operations
  relationshipFindUnique: vi.fn(),
  relationshipFindFirst: vi.fn(),
  relationshipCreate: vi.fn(),
  relationshipDelete: vi.fn(),
  // Relationship type operations
  relationshipTypeFindFirst: vi.fn(),
}));

// Mock Prisma with stateful implementations
vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      findMany: mocks.personFindMany,
      findFirst: mocks.personFindFirst,
      create: mocks.personCreate,
      update: mocks.personUpdate,
      delete: mocks.personDelete,
    },
    group: {
      findUnique: mocks.groupFindUnique,
      findMany: mocks.groupFindMany,
      findFirst: mocks.groupFindFirst,
      create: mocks.groupCreate,
      update: mocks.groupUpdate,
      delete: mocks.groupDelete,
    },
    relationship: {
      findUnique: mocks.relationshipFindUnique,
      findFirst: mocks.relationshipFindFirst,
      create: mocks.relationshipCreate,
      delete: mocks.relationshipDelete,
    },
    relationshipType: {
      findFirst: mocks.relationshipTypeFindFirst,
      findUnique: mocks.relationshipTypeFindFirst, // Alias for findUnique
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
import { POST as createPerson } from '../../app/api/people/route';
import { GET as getGroups, POST as createGroup } from '../../app/api/groups/route';
import { POST as createRelationship } from '../../app/api/relationships/route';

describe('Person Management Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();

    // Setup mock implementations that use the data store
    mocks.personCreate.mockImplementation(async ({ data }) => {
      const id = `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const person = { id, ...data, groups: [] };
      mockDataStore.people.set(id, person);
      return person;
    });

    mocks.personFindUnique.mockImplementation(async ({ where }) => {
      if (where.id && where.userId) {
        const person = mockDataStore.people.get(where.id);
        if (person && person.userId === where.userId) {
          return person;
        }
      }
      return null;
    });

    mocks.personFindMany.mockImplementation(async ({ where }) => {
      const people: any[] = [];
      mockDataStore.people.forEach((person) => {
        if (person.userId === where.userId) {
          people.push(person);
        }
      });
      return people;
    });

    mocks.groupCreate.mockImplementation(async ({ data }) => {
      const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const group = { id, ...data, people: [] };
      mockDataStore.groups.set(id, group);
      return group;
    });

    mocks.groupFindFirst.mockResolvedValue(null);

    mocks.groupFindMany.mockImplementation(async ({ where }) => {
      const groups: any[] = [];
      mockDataStore.groups.forEach((group) => {
        if (group.userId === where.userId) {
          groups.push(group);
        }
      });
      return groups;
    });

    mocks.relationshipTypeFindFirst.mockImplementation(async ({ where }) => {
      return mockDataStore.relationshipTypes.get(where.id) || null;
    });

    mocks.relationshipCreate.mockImplementation(async ({ data }) => {
      const id = `rel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const relationship = { id, ...data };
      mockDataStore.relationships.set(id, relationship);
      return relationship;
    });

    mocks.relationshipFindFirst.mockResolvedValue(null);
  });

  describe('Creating a person network', () => {
    it('should create multiple people and verify create calls', async () => {
      // Create first person
      const request1 = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'John',
          surname: 'Doe',
          relationshipToUserId: 'friend',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response1 = await createPerson(request1);
      expect(response1.status).toBe(201);
      const body1 = await response1.json();
      expect(body1.person.name).toBe('John');

      // Create second person
      const request2 = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Jane',
          surname: 'Smith',
          relationshipToUserId: 'friend',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response2 = await createPerson(request2);
      expect(response2.status).toBe(201);
      const body2 = await response2.json();
      expect(body2.person.name).toBe('Jane');

      // Verify both creates were called
      expect(mocks.personCreate).toHaveBeenCalledTimes(2);

      // Verify correct data was passed
      expect(mocks.personCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'John',
            surname: 'Doe',
            user: { connect: { id: 'user-123' } },
          }),
        })
      );
      expect(mocks.personCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Jane',
            surname: 'Smith',
            user: { connect: { id: 'user-123' } },
          }),
        })
      );
    });

    it('should create person connected through another person', async () => {
      // Setup: parent already exists
      const parent = { id: 'parent-1', name: 'Robert', userId: 'user-123' };
      mocks.personFindUnique.mockResolvedValue(parent);

      // Create child connected through parent
      const childRequest = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Robert Jr',
          surname: 'Doe',
          connectedThroughId: 'parent-1',
          relationshipToUserId: 'child',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const childResponse = await createPerson(childRequest);
      expect(childResponse.status).toBe(201);
      const childBody = await childResponse.json();
      expect(childBody.person.name).toBe('Robert Jr');

      // Verify relationship was created
      expect(mocks.relationshipCreate).toHaveBeenCalled();
    });
  });

  describe('Organizing people into groups', () => {
    it('should create groups and have them listed', async () => {
      // Create a group
      const createRequest = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Family',
          description: 'Family members',
          color: '#FF5733',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const createResponse = await createGroup(createRequest);
      expect(createResponse.status).toBe(201);
      const createBody = await createResponse.json();
      expect(createBody.group.name).toBe('Family');
      expect(createBody.group.color).toBe('#FF5733');

      // Create another group
      const createRequest2 = new Request('http://localhost/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Friends',
          description: 'Close friends',
          color: '#33FF57',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const createResponse2 = await createGroup(createRequest2);
      expect(createResponse2.status).toBe(201);

      // List all groups
      const listRequest = new Request('http://localhost/api/groups');
      const listResponse = await getGroups(listRequest);
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json();
      expect(listBody.groups).toHaveLength(2);
    });
  });

  describe('Creating relationships between people', () => {
    it('should create bidirectional friend relationship', async () => {
      // Create two people
      const person1 = { id: 'person-1', name: 'Alice', userId: 'user-123' };
      const person2 = { id: 'person-2', name: 'Bob', userId: 'user-123' };

      mockDataStore.people.set('person-1', person1);
      mockDataStore.people.set('person-2', person2);

      mocks.personFindUnique.mockImplementation(async ({ where }) => {
        const person = mockDataStore.people.get(where.id);
        if (person && person.userId === where.userId) {
          return person;
        }
        return null;
      });

      // Create friendship relationship
      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'person-1',
          relatedPersonId: 'person-2',
          relationshipTypeId: 'friend',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createRelationship(request);
      expect(response.status).toBe(201);

      // For friend relationship (symmetric), both directions should be created
      expect(mocks.relationshipCreate).toHaveBeenCalledTimes(2);
    });

    it('should create parent-child relationship with inverse', async () => {
      // Create two people
      const parent = { id: 'parent-1', name: 'Parent', userId: 'user-123' };
      const child = { id: 'child-1', name: 'Child', userId: 'user-123' };

      mockDataStore.people.set('parent-1', parent);
      mockDataStore.people.set('child-1', child);

      mocks.personFindUnique.mockImplementation(async ({ where }) => {
        const person = mockDataStore.people.get(where.id);
        if (person && person.userId === where.userId) {
          return person;
        }
        return null;
      });

      // Create parent relationship
      const request = new Request('http://localhost/api/relationships', {
        method: 'POST',
        body: JSON.stringify({
          personId: 'parent-1',
          relatedPersonId: 'child-1',
          relationshipTypeId: 'parent',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await createRelationship(request);
      expect(response.status).toBe(201);

      // Both parent and child (inverse) relationships should be created
      expect(mocks.relationshipCreate).toHaveBeenCalledTimes(2);

      // Verify the inverse relationship was created with correct type
      const calls = mocks.relationshipCreate.mock.calls;
      const inverseCall = calls.find(
        (call) => call[0].data.relationshipTypeId === 'child'
      );
      expect(inverseCall).toBeDefined();
      expect(inverseCall[0].data.personId).toBe('child-1');
      expect(inverseCall[0].data.relatedPersonId).toBe('parent-1');
    });
  });
});
