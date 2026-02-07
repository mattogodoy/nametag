import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
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
import { GET } from '@/app/api/dashboard/graph/route';

const { personFindMany } = mocks;

describe('Dashboard Graph API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should deduplicate when same edge is defined from both persons', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/dashboard/graph',
    );

    const peopleWithMutualRelationships = [
      {
        id: 'person-1',
        name: 'Alice',
        surname: null,
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
          },
        ],
      },
      {
        id: 'person-2',
        name: 'Bob',
        surname: null,
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
    ];

    personFindMany.mockResolvedValue(peopleWithMutualRelationships);

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // Should have 2 edges: person-1 -> person-2 (forward) and person-2 -> person-1 (inverse)
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

  it('should handle complex network with multiple people and deduplicate edges', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/dashboard/graph',
    );

    const peopleWithComplexNetwork = [
      {
        id: 'person-1',
        name: 'Alice',
        surname: null,
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
          },
          {
            personId: 'person-1',
            relatedPersonId: 'person-3',
            relationshipType: {
              label: 'family',
              color: '#FF0000',
              inverse: {
                label: 'family',
                color: '#FF0000',
              },
            },
          },
        ],
      },
      {
        id: 'person-2',
        name: 'Bob',
        surname: null,
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
          {
            personId: 'person-2',
            relatedPersonId: 'person-3',
            relationshipType: {
              label: 'colleague',
              color: '#0000FF',
              inverse: {
                label: 'colleague',
                color: '#0000FF',
              },
            },
          },
        ],
      },
      {
        id: 'person-3',
        name: 'Charlie',
        surname: null,
        nickname: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            personId: 'person-3',
            relatedPersonId: 'person-1',
            relationshipType: {
              label: 'family',
              color: '#FF0000',
              inverse: {
                label: 'family',
                color: '#FF0000',
              },
            },
          },
          {
            personId: 'person-3',
            relatedPersonId: 'person-2',
            relationshipType: {
              label: 'colleague',
              color: '#0000FF',
              inverse: {
                label: 'colleague',
                color: '#0000FF',
              },
            },
          },
        ],
      },
    ];

    personFindMany.mockResolvedValue(peopleWithComplexNetwork);

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // person-1 -> person-2 (forward + inverse) = 2 edges
    // person-1 -> person-3 (forward + inverse) = 2 edges
    // person-2 -> person-3 (forward + inverse) = 2 edges
    // Total: 6 edges
    expect(body.edges).toHaveLength(6);
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
    expect(body.edges).toContainEqual({
      source: 'person-1',
      target: 'person-3',
      type: 'family',
      color: '#FF0000',
    });
    expect(body.edges).toContainEqual({
      source: 'person-3',
      target: 'person-1',
      type: 'family',
      color: '#FF0000',
    });
    expect(body.edges).toContainEqual({
      source: 'person-2',
      target: 'person-3',
      type: 'colleague',
      color: '#0000FF',
    });
    expect(body.edges).toContainEqual({
      source: 'person-3',
      target: 'person-2',
      type: 'colleague',
      color: '#0000FF',
    });
  });
});
