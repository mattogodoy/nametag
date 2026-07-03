import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindFirst: vi.fn(),
  personFindMany: vi.fn(),
  personCreate: vi.fn(),
  personCount: vi.fn(),
  groupFindFirst: vi.fn(),
  groupCreate: vi.fn(),
  groupCount: vi.fn(),
  personGroupFindUnique: vi.fn(),
  personGroupCreate: vi.fn(),
  relTypeFindFirst: vi.fn(),
  relationshipFindFirst: vi.fn(),
  relationshipCreate: vi.fn(),
  journalEntryFindFirst: vi.fn(),
  journalEntryCreate: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  importantDateCount: vi.fn(),
  templateCount: vi.fn(),
  templateFindMany: vi.fn(),
  templateFindFirst: vi.fn(),
  templateCreate: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findFirst: mocks.personFindFirst,
      findMany: mocks.personFindMany,
      create: mocks.personCreate,
      count: mocks.personCount,
    },
    group: {
      findFirst: mocks.groupFindFirst,
      create: mocks.groupCreate,
      count: mocks.groupCount,
    },
    personGroup: {
      findUnique: mocks.personGroupFindUnique,
      create: mocks.personGroupCreate,
    },
    relationshipType: {
      findFirst: mocks.relTypeFindFirst,
    },
    relationship: {
      findFirst: mocks.relationshipFindFirst,
      create: mocks.relationshipCreate,
    },
    journalEntry: {
      findFirst: mocks.journalEntryFindFirst,
      create: mocks.journalEntryCreate,
    },
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
    importantDate: {
      count: mocks.importantDateCount,
    },
    customFieldTemplate: {
      count: mocks.templateCount,
      findMany: mocks.templateFindMany,
      findFirst: mocks.templateFindFirst,
      create: mocks.templateCreate,
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

vi.mock('../../lib/features', () => ({
  isSaasMode: vi.fn(() => false),
}));

import { POST as importRoute } from '../../app/api/user/import/route';

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_PAYLOAD = {
  version: '1.1',
  exportDate: '2026-01-01T00:00:00.000Z',
  groups: [],
  people: [],
  relationshipTypes: [],
  journalEntries: [],
};

function journalCreatePersonIds(): string[][] {
  return mocks.journalEntryCreate.mock.calls.map((call) => {
    const data = (call[0] as { data: { people?: { create: Array<{ person: { connect: { id: string } } }> } } }).data;
    return (data.people?.create ?? []).map((c) => c.person.connect.id);
  });
}

describe('Import - journal entry person linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.personFindFirst.mockResolvedValue(null);
    mocks.personCreate.mockResolvedValue({ id: 'new-person-1' });
    mocks.groupFindFirst.mockResolvedValue(null);
    mocks.groupCreate.mockResolvedValue({ id: 'new-group-1' });
    mocks.personGroupFindUnique.mockResolvedValue(null);
    mocks.personGroupCreate.mockResolvedValue({});
    mocks.relTypeFindFirst.mockResolvedValue(null);
    mocks.relationshipFindFirst.mockResolvedValue(null);
    mocks.journalEntryFindFirst.mockResolvedValue(null);
    mocks.journalEntryCreate.mockResolvedValue({ id: 'new-entry-1' });
    mocks.personFindMany.mockResolvedValue([]);
  });

  it('links journal people via exported IDs mapped through the person ID map', async () => {
    // The person is created fresh during import, so the old export ID maps to a new DB ID.
    mocks.personCreate.mockResolvedValue({ id: 'new-robert' });
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'new-robert',
        name: 'Robert',
        surname: 'Johnson',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: 'Dad',
      },
    ]);

    const response = await importRoute(
      makeRequest({
        ...BASE_PAYLOAD,
        people: [
          {
            id: 'old-robert',
            name: 'Robert',
            surname: 'Johnson',
            displayNameOverride: 'Dad',
            groups: [],
            relationships: [],
          },
        ],
        journalEntries: [
          {
            id: 'entry-1',
            title: 'Dinner',
            date: '2026-05-01T00:00:00.000Z',
            body: 'Nice dinner',
            // Name is the display override; only the ID identifies the person reliably.
            people: ['Dad'],
            peopleIds: ['old-robert'],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(journalCreatePersonIds()).toEqual([['new-robert']]);
  });

  it('falls back to canonical name matching for old exports without peopleIds', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'db-robert',
        name: 'Robert',
        surname: 'Johnson',
        middleName: null,
        secondLastName: null,
        nickname: null,
        // Existing person has an override, but old exports reference the real name.
        displayNameOverride: 'Dad',
      },
    ]);

    const response = await importRoute(
      makeRequest({
        ...BASE_PAYLOAD,
        journalEntries: [
          {
            id: 'entry-1',
            title: 'Dinner',
            date: '2026-05-01T00:00:00.000Z',
            body: 'Nice dinner',
            people: ['Robert Johnson'],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    expect(journalCreatePersonIds()).toEqual([['db-robert']]);
  });

  it('does not let one person\'s display override shadow another person\'s real name', async () => {
    mocks.personFindMany.mockResolvedValue([
      {
        id: 'db-mom',
        name: 'Mom',
        surname: null,
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: null,
      },
      {
        id: 'db-anna',
        name: 'Anna',
        surname: 'Berg',
        middleName: null,
        secondLastName: null,
        nickname: null,
        displayNameOverride: 'Mom',
      },
    ]);

    const response = await importRoute(
      makeRequest({
        ...BASE_PAYLOAD,
        journalEntries: [
          {
            id: 'entry-1',
            title: 'Lunch',
            date: '2026-05-02T00:00:00.000Z',
            body: 'Lunch with mom',
            people: ['Mom'],
          },
        ],
      })
    );

    expect(response.status).toBe(200);
    // Must resolve to the person really named Mom, regardless of iteration order.
    expect(journalCreatePersonIds()).toEqual([['db-mom']]);
  });
});
