import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  userFindUnique: vi.fn(),
  variantFindMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  customValueFindMany: vi.fn(),
  importantDateFindMany: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
    relationshipLabelVariant: {
      findMany: mocks.variantFindMany,
    },
    personGroup: {
      findMany: mocks.personGroupFindMany,
    },
    personCustomFieldValue: {
      findMany: mocks.customValueFindMany,
    },
    importantDate: {
      findMany: mocks.importantDateFindMany,
    },
  },
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user123', email: 'test@example.com', name: 'Test', surname: null, nickname: null },
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
  createModuleLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import after mocking
import { GET } from '@/app/api/dashboard/graph/route';

const {
  personFindMany,
  userFindUnique,
  variantFindMany,
  personGroupFindMany,
  customValueFindMany,
  importantDateFindMany,
} = mocks;

describe('Dashboard Graph API Route: label resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userFindUnique.mockResolvedValue({ photo: null });
  });

  it('keeps the type label and issues no person-context query when no variants are configured', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/graph');

    variantFindMany.mockResolvedValue([]);
    personFindMany.mockResolvedValueOnce([
      {
        id: 'person-1',
        name: 'Alice',
        surname: null,
        nickname: null,
        displayNameOverride: null,
        photo: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            personId: 'person-1',
            relatedPersonId: 'person-2',
            relationshipType: {
              id: 'type-1',
              label: 'friend',
              color: '#00FF00',
              inverse: {
                id: 'type-1',
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
        displayNameOverride: null,
        photo: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [],
      },
    ]);

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.edges).toContainEqual(
      expect.objectContaining({ source: 'person-1', target: 'person-2', type: 'friend' }),
    );
    expect(body.edges).toContainEqual(
      expect.objectContaining({ source: 'person-2', target: 'person-1', type: 'friend' }),
    );

    // The route loads variants once...
    expect(variantFindMany).toHaveBeenCalledTimes(1);
    // ...but since nothing has a condition, no per-person context is loaded.
    expect(personGroupFindMany).not.toHaveBeenCalled();
    expect(customValueFindMany).not.toHaveBeenCalled();
    expect(importantDateFindMany).not.toHaveBeenCalled();
    // The only person query is the graph's own people query.
    expect(personFindMany).toHaveBeenCalledTimes(1);
  });

  it('resolves a gender variant on the direct edge and the inverse type on the reverse edge', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/graph');

    variantFindMany.mockResolvedValue([
      {
        relationshipTypeId: 'type-sibling',
        label: 'frere',
        conditions: [
          {
            subject: 'DESCRIBED',
            source: 'PERSON_FIELD',
            subjectRef: 'gender',
            operator: 'IS',
            operand: 'lit:Homme',
          },
        ],
      },
      {
        relationshipTypeId: 'type-sibling-inverse',
        label: 'soeur',
        conditions: [
          {
            subject: 'DESCRIBED',
            source: 'PERSON_FIELD',
            subjectRef: 'gender',
            operator: 'IS',
            operand: 'lit:Femme',
          },
        ],
      },
    ]);

    personFindMany.mockResolvedValueOnce([
      {
        id: 'person-1',
        name: 'Alice',
        surname: null,
        nickname: null,
        displayNameOverride: null,
        photo: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [
          {
            personId: 'person-1',
            relatedPersonId: 'person-2',
            relationshipType: {
              id: 'type-sibling',
              label: 'sibling',
              color: '#00FF00',
              inverse: {
                id: 'type-sibling-inverse',
                label: 'sibling-inverse',
                color: '#0000FF',
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
        displayNameOverride: null,
        photo: null,
        relationshipToUser: null,
        groups: [],
        relationshipsFrom: [],
      },
    ]);

    // Person-context query issued by the resolver for the gender field.
    personFindMany.mockResolvedValueOnce([
      { id: 'person-1', gender: 'Homme' },
      { id: 'person-2', gender: 'Femme' },
    ]);

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // person-1 (male) describes the direct edge: matches the "frere" variant.
    expect(body.edges).toContainEqual(
      expect.objectContaining({ source: 'person-1', target: 'person-2', type: 'frere' }),
    );
    // person-2 (female) describes the reverse edge, resolved against the
    // inverse type's own variant, not the direct type's.
    expect(body.edges).toContainEqual(
      expect.objectContaining({ source: 'person-2', target: 'person-1', type: 'soeur' }),
    );
  });

  it('issues at most one variants query and four context queries for a fifty-person graph', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/graph');

    variantFindMany.mockResolvedValue([
      {
        relationshipTypeId: 'type-sibling',
        label: 'frere',
        conditions: [
          {
            subject: 'DESCRIBED',
            source: 'PERSON_FIELD',
            subjectRef: 'gender',
            operator: 'IS',
            operand: 'lit:Homme',
          },
        ],
      },
    ]);

    const people = Array.from({ length: 50 }, (_, i) => ({
      id: `person-${i}`,
      name: `Person ${i}`,
      surname: null,
      nickname: null,
      displayNameOverride: null,
      photo: null,
      relationshipToUser: null,
      groups: [],
      relationshipsFrom: [],
    }));

    personFindMany.mockResolvedValueOnce(people);
    personFindMany.mockResolvedValueOnce(
      people.map((p) => ({ id: p.id, gender: 'Homme' })),
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    // One query for the graph's own people, one for the resolver's field context.
    // No more than that, no matter how many people are in the graph.
    expect(personFindMany).toHaveBeenCalledTimes(2);
    expect(variantFindMany).toHaveBeenCalledTimes(1);
    // Only gender is referenced, so the other three context queries never fire.
    expect(personGroupFindMany).not.toHaveBeenCalled();
    expect(customValueFindMany).not.toHaveBeenCalled();
    expect(importantDateFindMany).not.toHaveBeenCalled();
  });
});
