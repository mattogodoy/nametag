import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  relationshipFindFirst: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    relationship: {
      findFirst: mocks.relationshipFindFirst,
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

import { GET } from '../../app/api/relationships/[id]/route';

describe('GET /api/relationships/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a relationship by ID', async () => {
    const mockRelationship = {
      id: 'rel-1',
      personId: 'person-1',
      relatedPersonId: 'person-2',
      person: {
        id: 'person-1',
        name: 'Alice',
        surname: null,
        middleName: null,
        secondLastName: null,
        nickname: null,
        lastContact: null,
        notes: null,
        relationshipToUserId: null,
        contactReminderEnabled: false,
        contactReminderInterval: null,
        contactReminderIntervalUnit: null,
        lastContactReminderSent: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      relatedPerson: { id: 'person-2', name: 'Bob', surname: null, nickname: null },
      relationshipType: { id: 'type-1', name: 'FRIEND', label: 'Friend', color: '#10B981' },
    };

    mocks.relationshipFindFirst.mockResolvedValue(mockRelationship);

    const request = new Request('http://localhost/api/relationships/rel-1');
    const context = { params: Promise.resolve({ id: 'rel-1' }) };

    const response = await GET(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.relationship).toEqual(mockRelationship);
  });

  it('should check ownership via the where clause', async () => {
    mocks.relationshipFindFirst.mockResolvedValue(null);

    const request = new Request('http://localhost/api/relationships/rel-1');
    const context = { params: Promise.resolve({ id: 'rel-1' }) };

    await GET(request, context);

    expect(mocks.relationshipFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'rel-1',
          person: { userId: 'user-123', deletedAt: null },
          relatedPerson: { deletedAt: null },
          OR: [
            { relationshipTypeId: null },
            { relationshipType: { deletedAt: null } },
          ],
        }),
      })
    );
  });

  it('should not include deletedAt in person or relatedPerson select', async () => {
    mocks.relationshipFindFirst.mockResolvedValue(null);

    const request = new Request('http://localhost/api/relationships/rel-1');
    const context = { params: Promise.resolve({ id: 'rel-1' }) };

    await GET(request, context);

    const callArg = mocks.relationshipFindFirst.mock.calls[0][0];
    expect(callArg.include.person.select).not.toHaveProperty('deletedAt');
    expect(callArg.include.relatedPerson.select).not.toHaveProperty('deletedAt');
  });

  it('should return 404 for non-existent relationship', async () => {
    mocks.relationshipFindFirst.mockResolvedValue(null);

    const request = new Request('http://localhost/api/relationships/non-existent');
    const context = { params: Promise.resolve({ id: 'non-existent' }) };

    const response = await GET(request, context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('not found');
  });

  it('should return 404 when relationship belongs to another user', async () => {
    // Since ownership is checked in the where clause, findFirst returns null
    mocks.relationshipFindFirst.mockResolvedValue(null);

    const request = new Request('http://localhost/api/relationships/other-user-rel');
    const context = { params: Promise.resolve({ id: 'other-user-rel' }) };

    const response = await GET(request, context);

    expect(response.status).toBe(404);
  });
});
