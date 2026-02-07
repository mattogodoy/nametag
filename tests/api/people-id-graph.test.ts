import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user123', email: 'test@example.com', name: 'Test' },
    }),
  ),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { GET } from '@/app/api/people/[id]/graph/route';

const { personFindUnique } = mocks;

describe('People Graph API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('deduplication of edges', () => {
    it('should deduplicate edges between related people when both directions exist', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/people/person-1/graph',
      );

      const mockPerson = {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        nickname: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            personId: 'person-1',
            relatedPersonId: 'person-2',
            relationshipType: {
              label: 'friend',
              color: '#00FF00',
              inverse: {
                label: 'friend',
                color: '#00FF00',
              },
            },
            relatedPerson: {
              id: 'person-2',
              name: 'Bob',
              surname: 'Johnson',
              nickname: null,
              relationshipToUser: null,
              groups: [],
              relationshipsFrom: [
                {
                  personId: 'person-2',
                  relatedPersonId: 'person-1',
                  relationshipType: {
                    label: 'friend',
                    color: '#00FF00',
                    inverse: {
                      label: 'friend',
                      color: '#00FF00',
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      personFindUnique.mockResolvedValue(mockPerson);

      const response = await GET(request, {
        params: Promise.resolve({ id: 'person-1' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should have 3 nodes: person-1 (center), user, person-2
      expect(body.nodes).toHaveLength(3);
      // Should have 2 edges (deduplicated): person-1 -> person-2 and person-2 -> person-1
      expect(body.edges).toHaveLength(2);
      expect(body.edges).toContainEqual({
        source: 'person-1',
        target: 'person-2',
        type: 'friend',
        color: '#00FF00',
      });
      expect(body.edges).toContainEqual({
        source: 'person-2',
        target: 'person-1',
        type: 'friend',
        color: '#00FF00',
      });
    });

    it('should deduplicate edges when processing relationships from multiple related people', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/people/person-1/graph',
      );

      const mockPerson = {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        nickname: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            personId: 'person-1',
            relatedPersonId: 'person-2',
            relationshipType: {
              label: 'child',
              color: '#00FF00',
              inverse: {
                label: 'parent',
                color: '#0000FF',
              },
            },
            relatedPerson: {
              id: 'person-2',
              name: 'Bob',
              surname: 'Johnson',
              nickname: null,
              relationshipToUser: null,
              groups: [],
              relationshipsFrom: [
                {
                  personId: 'person-2',
                  relatedPersonId: 'person-1',
                  relationshipType: {
                    label: 'parent',
                    color: '#0000FF',
                    inverse: {
                      label: 'child',
                      color: '#00FF00',
                    },
                  },
                },
                {
                  personId: 'person-2',
                  relatedPersonId: 'person-3',
                  relationshipType: {
                    label: 'colleague',
                    color: '#FF0000',
                    inverse: {
                      label: 'colleague',
                      color: '#FF0000',
                    },
                  },
                },
              ],
            },
          },
          {
            personId: 'person-1',
            relatedPersonId: 'person-3',
            relationshipType: {
              label: 'friend',
              color: '#FFFF00',
              inverse: {
                label: 'friend',
                color: '#FFFF00',
              },
            },
            relatedPerson: {
              id: 'person-3',
              name: 'Charlie',
              surname: 'Brown',
              nickname: null,
              relationshipToUser: null,
              groups: [],
              relationshipsFrom: [
                {
                  personId: 'person-3',
                  relatedPersonId: 'person-1',
                  relationshipType: {
                    label: 'friend',
                    color: '#FFFF00',
                    inverse: {
                      label: 'friend',
                      color: '#FFFF00',
                    },
                  },
                },
                {
                  personId: 'person-3',
                  relatedPersonId: 'person-2',
                  relationshipType: {
                    label: 'colleague',
                    color: '#FF0000',
                    inverse: {
                      label: 'colleague',
                      color: '#FF0000',
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      personFindUnique.mockResolvedValue(mockPerson);

      const response = await GET(request, {
        params: Promise.resolve({ id: 'person-1' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should have 4 nodes: person-1 (center), user, person-2, person-3
      expect(body.nodes).toHaveLength(4);
      // person-1 -> person-2 (forward + inverse) = 2 edges
      // person-1 -> person-3 (forward + inverse) = 2 edges
      // person-2 -> person-3 (forward + inverse) = 2 edges
      expect(body.edges.length).toBe(6);
      // Check that person-2 -> person-3 edge exists
      expect(body.edges).toContainEqual({
        source: 'person-2',
        target: 'person-3',
        type: 'colleague',
        color: '#FF0000',
      });
      // Check that person-3 -> person-2 edge exists
      expect(body.edges).toContainEqual({
        source: 'person-3',
        target: 'person-2',
        type: 'colleague',
        color: '#FF0000',
      });
    });

    it('should filter out edges to people not directly related to person', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/people/person-1/graph',
      );

      const mockPerson = {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        nickname: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            personId: 'person-1',
            relatedPersonId: 'person-2',
            relationshipType: {
              label: 'friend',
              color: '#00FF00',
              inverse: null,
            },
            relatedPerson: {
              id: 'person-2',
              name: 'Bob',
              surname: 'Johnson',
              nickname: null,
              relationshipToUser: null,
              groups: [],
              relationshipsFrom: [
                {
                  personId: 'person-2',
                  relatedPersonId: 'person-3', // Not in the graph (person-3 is not a direct relationship of person-1)
                  relationshipType: {
                    label: 'acquaintance',
                    color: '#CCCCCC',
                    inverse: null,
                  },
                },
              ],
            },
          },
        ],
      };

      personFindUnique.mockResolvedValue(mockPerson);

      const response = await GET(request, {
        params: Promise.resolve({ id: 'person-1' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should have 3 nodes: person-1 (center), user, person-2
      expect(body.nodes).toHaveLength(3);
      // Should only have 1 edge (person-1 -> person-2) since person-3 is not in the graph
      expect(body.edges).toHaveLength(1);
      expect(body.edges[0]).toEqual({
        source: 'person-1',
        target: 'person-2',
        type: 'friend',
        color: '#00FF00',
      });
    });

    it('should include user relationships for the center person', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/people/person-1/graph',
      );

      const mockPerson = {
        id: 'person-1',
        name: 'Alice',
        surname: 'Smith',
        nickname: null,
        relationshipToUser: {
          label: 'family',
          color: '#FF0000',
          inverse: {
            label: 'family',
            color: '#FF0000',
          },
        },
        groups: [],
        relationshipsFrom: [],
      };

      personFindUnique.mockResolvedValue(mockPerson);

      const response = await GET(request, {
        params: Promise.resolve({ id: 'person-1' }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      // Should have 2 nodes: person-1 (center) and user
      expect(body.nodes).toHaveLength(2);
      // Should have 2 edges: person-1 -> user and user -> person-1
      expect(body.edges).toHaveLength(2);
      expect(body.edges).toContainEqual({
        source: 'person-1',
        target: 'user-user123',
        type: 'family',
        color: '#FF0000',
      });
      expect(body.edges).toContainEqual({
        source: 'user-user123',
        target: 'person-1',
        type: 'family',
        color: '#FF0000',
      });
    });
  });
});
