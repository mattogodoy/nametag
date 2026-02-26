import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  cardDavConnectionFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
    },
    cardDavConnection: {
      findUnique: mocks.cardDavConnectionFindUnique,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { POST } from '../../app/api/people/bulk/orphans/route';

describe('Bulk Orphans API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return orphans for multiple people', async () => {
    const allPeople = [
      {
        id: 'person-a',
        relationshipToUser: { id: 'rt1' },
        relationshipsFrom: [{ id: 'r1', relatedPersonId: 'orphan-1' }],
        relationshipsTo: [],
      },
      {
        id: 'person-b',
        relationshipToUser: { id: 'rt1' },
        relationshipsFrom: [{ id: 'r2', relatedPersonId: 'orphan-2' }],
        relationshipsTo: [],
      },
      {
        id: 'orphan-1',
        name: 'Orphan',
        surname: 'One',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [],
        relationshipsTo: [{ id: 'r1', personId: 'person-a' }],
      },
      {
        id: 'orphan-2',
        name: 'Orphan',
        surname: 'Two',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [],
        relationshipsTo: [{ id: 'r2', personId: 'person-b' }],
      },
      {
        id: 'non-orphan',
        name: 'Not',
        surname: 'Orphan',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [{ id: 'r-other', relatedPersonId: 'someone-else' }],
        relationshipsTo: [{ id: 'r3', personId: 'person-a' }],
      },
    ];

    mocks.personFindMany.mockResolvedValue(allPeople);
    mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({ personIds: ['person-a', 'person-b'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orphans).toHaveLength(2);
    expect(body.orphans.map((o: { id: string }) => o.id).sort()).toEqual(['orphan-1', 'orphan-2']);
    expect(body.hasCardDavSync).toBe(false);
  });

  it('should exclude people being deleted from orphan check', async () => {
    const allPeople = [
      {
        id: 'person-a',
        name: 'Person',
        surname: 'A',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [{ id: 'r1', relatedPersonId: 'person-b' }],
        relationshipsTo: [],
      },
      {
        id: 'person-b',
        name: 'Person',
        surname: 'B',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [],
        relationshipsTo: [{ id: 'r1', personId: 'person-a' }],
      },
    ];

    mocks.personFindMany.mockResolvedValue(allPeople);
    mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({ personIds: ['person-a', 'person-b'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orphans).toHaveLength(0);
  });

  it('should report hasCardDavSync when connection exists', async () => {
    mocks.personFindMany.mockResolvedValue([]);
    mocks.cardDavConnectionFindUnique.mockResolvedValue({ id: 'conn-1' });

    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({ personIds: ['person-a'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.hasCardDavSync).toBe(true);
  });

  it('should reject invalid request body', async () => {
    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
