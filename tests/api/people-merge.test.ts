import { describe, it, expect, beforeEach, vi } from 'vitest';

// Valid CUID constants for test IDs
const PRIMARY_ID = 'clprimary00000000000000001';
const SECONDARY_ID = 'clsecondary000000000000001';
const PERSON_3_ID = 'clperson30000000000000001';
const PERSON_4_ID = 'clperson40000000000000001';
const PERSON_5_ID = 'clperson50000000000000001';
const USER_ID = 'cluser00000000000000000001';
const SAME_ID = 'clsame000000000000000000001';

// Use vi.hoisted to create mocks before hoisting
const { mocks, mockPrisma } = vi.hoisted(() => {
  const m = {
    personFindUnique: vi.fn(),
    personUpdate: vi.fn(),
    personPhoneUpdateMany: vi.fn(),
    personPhoneDeleteMany: vi.fn(),
    personEmailUpdateMany: vi.fn(),
    personEmailDeleteMany: vi.fn(),
    personAddressUpdateMany: vi.fn(),
    personAddressDeleteMany: vi.fn(),
    personUrlUpdateMany: vi.fn(),
    personUrlDeleteMany: vi.fn(),
    personIMUpdateMany: vi.fn(),
    personIMDeleteMany: vi.fn(),
    personLocationUpdateMany: vi.fn(),
    personLocationDeleteMany: vi.fn(),
    personCustomFieldUpdateMany: vi.fn(),
    personCustomFieldDeleteMany: vi.fn(),
    importantDateUpdateMany: vi.fn(),
    importantDateDeleteMany: vi.fn(),
    personGroupCreateMany: vi.fn(),
    personGroupDeleteMany: vi.fn(),
    relationshipUpdateMany: vi.fn(),
    cardDavMappingFindUnique: vi.fn(),
    cardDavMappingDeleteMany: vi.fn(),
    cardDavConnectionFindUnique: vi.fn(),
    createCardDavClient: vi.fn(),
    deleteVCardDirect: vi.fn(),
    mockDeleteVCard: vi.fn(),
    mockFetchAddressBooks: vi.fn(),
    mockFetchVCards: vi.fn(),
    withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  };

  const prismaClient: Record<string, unknown> = {
    person: { findUnique: m.personFindUnique, update: m.personUpdate },
    personPhone: { updateMany: m.personPhoneUpdateMany, deleteMany: m.personPhoneDeleteMany },
    personEmail: { updateMany: m.personEmailUpdateMany, deleteMany: m.personEmailDeleteMany },
    personAddress: { updateMany: m.personAddressUpdateMany, deleteMany: m.personAddressDeleteMany },
    personUrl: { updateMany: m.personUrlUpdateMany, deleteMany: m.personUrlDeleteMany },
    personIM: { updateMany: m.personIMUpdateMany, deleteMany: m.personIMDeleteMany },
    personLocation: { updateMany: m.personLocationUpdateMany, deleteMany: m.personLocationDeleteMany },
    personCustomField: { updateMany: m.personCustomFieldUpdateMany, deleteMany: m.personCustomFieldDeleteMany },
    importantDate: { updateMany: m.importantDateUpdateMany, deleteMany: m.importantDateDeleteMany },
    personGroup: { createMany: m.personGroupCreateMany, deleteMany: m.personGroupDeleteMany },
    relationship: { updateMany: m.relationshipUpdateMany },
    cardDavMapping: { findUnique: m.cardDavMappingFindUnique, deleteMany: m.cardDavMappingDeleteMany },
    cardDavConnection: { findUnique: m.cardDavConnectionFindUnique },
  };

  // $transaction passes the same mock client as the tx argument
  prismaClient.$transaction = vi.fn((fn: (tx: typeof prismaClient) => Promise<void>) =>
    fn(prismaClient)
  );

  return { mocks: m, mockPrisma: prismaClient };
});

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'cluser00000000000000000001', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: mocks.createCardDavClient,
  deleteVCardDirect: mocks.deleteVCardDirect,
}));

vi.mock('@/lib/carddav/retry', () => ({
  withRetry: mocks.withRetry,
}));

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
import { POST } from '@/app/api/people/merge/route';

// Factory helper
interface PersonOverrides {
  id?: string;
  name?: string;
  surname?: string | null;
  middleName?: string | null;
  secondLastName?: string | null;
  nickname?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  anniversary?: Date | null;
  lastContact?: Date | null;
  photo?: string | null;
  notes?: string | null;
  relationshipToUserId?: string | null;
  groups?: Array<{ groupId: string; personId: string }>;
  relationshipsFrom?: Array<{
    id: string;
    personId: string;
    relatedPersonId: string;
    relationshipTypeId: string;
    deletedAt?: Date | null;
  }>;
  relationshipsTo?: Array<{
    id: string;
    personId: string;
    relatedPersonId: string;
    relationshipTypeId: string;
    deletedAt?: Date | null;
  }>;
  phoneNumbers?: Array<{ id: string; number: string; personId: string }>;
  emails?: Array<{ id: string; email: string; personId: string }>;
  addresses?: Array<{
    id: string;
    personId: string;
    streetLine1?: string | null;
    streetLine2?: string | null;
    locality?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>;
  urls?: Array<{ id: string; url: string; personId: string }>;
  imHandles?: Array<{
    id: string;
    protocol: string;
    handle: string;
    personId: string;
  }>;
  locations?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    personId: string;
  }>;
  customFields?: Array<{
    id: string;
    key: string;
    value: string;
    personId: string;
  }>;
  importantDates?: Array<{
    id: string;
    title: string;
    date: Date | string;
    personId: string;
  }>;
  cardDavMapping?: { id: string; href: string; etag: string | null; connectionId: string; uid: string; connection: Record<string, unknown> } | null;
}

function makePerson(overrides: PersonOverrides = {}) {
  const id = overrides.id ?? PRIMARY_ID;
  return {
    id,
    userId: USER_ID,
    name: overrides.name ?? 'John',
    surname: overrides.surname ?? null,
    middleName: overrides.middleName ?? null,
    secondLastName: overrides.secondLastName ?? null,
    nickname: overrides.nickname ?? null,
    prefix: overrides.prefix ?? null,
    suffix: overrides.suffix ?? null,
    organization: overrides.organization ?? null,
    jobTitle: overrides.jobTitle ?? null,
    gender: overrides.gender ?? null,
    anniversary: overrides.anniversary ?? null,
    lastContact: overrides.lastContact ?? null,
    photo: overrides.photo ?? null,
    notes: overrides.notes ?? null,
    relationshipToUserId: overrides.relationshipToUserId ?? null,
    deletedAt: null,
    groups: overrides.groups ?? [],
    relationshipsFrom: overrides.relationshipsFrom ?? [],
    relationshipsTo: overrides.relationshipsTo ?? [],
    phoneNumbers: overrides.phoneNumbers ?? [],
    emails: overrides.emails ?? [],
    addresses: overrides.addresses ?? [],
    urls: overrides.urls ?? [],
    imHandles: overrides.imHandles ?? [],
    locations: overrides.locations ?? [],
    customFields: overrides.customFields ?? [],
    importantDates: overrides.importantDates ?? [],
    cardDavMapping: overrides.cardDavMapping ?? null,
  };
}

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/people/merge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/people/merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Validation ────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 when primaryId === secondaryId', async () => {
      const request = makeRequest({
        primaryId: SAME_ID,
        secondaryId: SAME_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
    });

    it('returns 404 when primary person not found', async () => {
      mocks.personFindUnique.mockResolvedValueOnce(null);
      mocks.personFindUnique.mockResolvedValueOnce(makePerson({ id: SECONDARY_ID }));

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Primary person not found');
    });

    it('returns 404 when secondary person not found', async () => {
      mocks.personFindUnique.mockResolvedValueOnce(makePerson({ id: PRIMARY_ID }));
      mocks.personFindUnique.mockResolvedValueOnce(null);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Secondary person not found');
    });
  });

  // ─── Scalar field overrides ────────────────────────────────────

  describe('scalar field overrides', () => {
    it('applies name/surname/organization overrides to primary', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
        fieldOverrides: {
          name: 'Jane',
          surname: 'Smith',
          organization: 'Acme Corp',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          name: 'Jane',
          surname: 'Smith',
          organization: 'Acme Corp',
        }),
      });
    });

    it('handles date fields converting strings to Date', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
        fieldOverrides: {
          anniversary: '2020-06-15',
          lastContact: '2025-01-10',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          anniversary: new Date('2020-06-15'),
          lastContact: new Date('2025-01-10'),
        }),
      });
    });

    it('auto-transfers secondary scalar fields when primary is null', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        name: 'John',
        surname: null,
        organization: null,
        jobTitle: null,
        notes: null,
        relationshipToUserId: null,
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        name: 'John',
        surname: 'Doe',
        organization: 'Acme Corp',
        jobTitle: 'Engineer',
        notes: 'Some notes',
        relationshipToUserId: 'rel-type-friend',
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          surname: 'Doe',
          organization: 'Acme Corp',
          jobTitle: 'Engineer',
          notes: 'Some notes',
          relationshipToUser: { connect: { id: 'rel-type-friend' } },
        }),
      });

      // name should NOT be auto-transferred since primary already has it
      const updateData = mocks.personUpdate.mock.calls[0][0].data;
      expect(updateData).not.toHaveProperty('name');
    });

    it('does not auto-transfer when field override exists', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        organization: null,
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        organization: 'Acme Corp',
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
        fieldOverrides: {
          organization: 'Different Corp',
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Should use the explicit override, not auto-transfer
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          organization: 'Different Corp',
        }),
      });
    });

    it('auto-transfers date fields when primary is null', async () => {
      const anniversary = new Date('2020-06-15');
      const lastContact = new Date('2025-01-10');
      const primary = makePerson({
        id: PRIMARY_ID,
        anniversary: null,
        lastContact: null,
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        anniversary,
        lastContact,
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          anniversary,
          lastContact,
        }),
      });
    });

    it('handles relationshipToUserId connect/disconnect', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      // connect
      const request1 = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
        fieldOverrides: {
          relationshipToUserId: 'rel-type-1',
        },
      });

      const response1 = await POST(request1);
      expect(response1.status).toBe(200);
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          relationshipToUser: { connect: { id: 'rel-type-1' } },
        }),
      });

      vi.clearAllMocks();

      // disconnect
      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const request2 = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
        fieldOverrides: {
          relationshipToUserId: null,
        },
      });

      const response2 = await POST(request2);
      expect(response2.status).toBe(200);
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PRIMARY_ID },
        data: expect.objectContaining({
          relationshipToUser: { disconnect: true },
        }),
      });
    });
  });

  // ─── Multi-value field transfer with deduplication ─────────────

  describe('multi-value field transfer with deduplication', () => {
    it('transfers phones from secondary, skipping duplicates by number', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        phoneNumbers: [{ id: 'ph-1', number: '+1234567890', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        phoneNumbers: [
          { id: 'ph-2', number: '+1234567890', personId: SECONDARY_ID }, // duplicate
          { id: 'ph-3', number: '+0987654321', personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Only ph-3 transferred (ph-2 is a duplicate)
      expect(mocks.personPhoneUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ph-3'] } },
        data: { personId: PRIMARY_ID },
      });

      // Remaining secondary phones deleted
      expect(mocks.personPhoneDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
    });

    it('transfers emails, skipping duplicates (case-insensitive)', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        emails: [{ id: 'em-1', email: 'John@Example.com', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        emails: [
          { id: 'em-2', email: 'john@example.com', personId: SECONDARY_ID }, // duplicate (case)
          { id: 'em-3', email: 'jane@example.com', personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personEmailUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['em-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers addresses, skipping duplicates by composite key', async () => {
      const addr = {
        streetLine1: '123 Main St',
        streetLine2: null,
        locality: 'Springfield',
        region: 'IL',
        postalCode: '62701',
        country: 'US',
      };

      const primary = makePerson({
        id: PRIMARY_ID,
        addresses: [{ id: 'addr-1', personId: PRIMARY_ID, ...addr }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        addresses: [
          { id: 'addr-2', personId: SECONDARY_ID, ...addr }, // duplicate
          {
            id: 'addr-3',
            personId: SECONDARY_ID,
            streetLine1: '456 Oak Ave',
            streetLine2: null,
            locality: 'Chicago',
            region: 'IL',
            postalCode: '60601',
            country: 'US',
          }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personAddressUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['addr-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers URLs, skipping duplicates (case-insensitive)', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        urls: [{ id: 'url-1', url: 'https://Example.com', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        urls: [
          { id: 'url-2', url: 'https://example.com', personId: SECONDARY_ID }, // duplicate
          { id: 'url-3', url: 'https://other.com', personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personUrlUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['url-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers IM handles, skipping duplicates by protocol:handle', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        imHandles: [{ id: 'im-1', protocol: 'xmpp', handle: 'john@jabber.org', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        imHandles: [
          { id: 'im-2', protocol: 'xmpp', handle: 'john@jabber.org', personId: SECONDARY_ID }, // duplicate
          { id: 'im-3', protocol: 'telegram', handle: '@john', personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personIMUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['im-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers locations, skipping duplicates by lat,lng', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        locations: [{ id: 'loc-1', latitude: 40.7128, longitude: -74.006, personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        locations: [
          { id: 'loc-2', latitude: 40.7128, longitude: -74.006, personId: SECONDARY_ID }, // duplicate
          { id: 'loc-3', latitude: 34.0522, longitude: -118.2437, personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personLocationUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['loc-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers custom fields, skipping duplicates by key:value', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        customFields: [{ id: 'cf-1', key: 'twitter', value: '@john', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        customFields: [
          { id: 'cf-2', key: 'twitter', value: '@john', personId: SECONDARY_ID }, // duplicate
          { id: 'cf-3', key: 'github', value: 'johndoe', personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personCustomFieldUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['cf-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers important dates, skipping duplicates by title:date', async () => {
      const dateStr = '2020-06-15T00:00:00.000Z';
      const primary = makePerson({
        id: PRIMARY_ID,
        importantDates: [{ id: 'id-1', title: 'Birthday', date: dateStr, personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        importantDates: [
          { id: 'id-2', title: 'Birthday', date: dateStr, personId: SECONDARY_ID }, // duplicate
          { id: 'id-3', title: 'Graduation', date: '2022-05-20T00:00:00.000Z', personId: SECONDARY_ID }, // unique
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.importantDateUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['id-3'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('deletes remaining secondary multi-value records after transfer', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        phoneNumbers: [{ id: 'ph-1', number: '+111', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        phoneNumbers: [{ id: 'ph-2', number: '+111', personId: SECONDARY_ID }], // all duplicates
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // No phones transferred (all duplicates)
      expect(mocks.personPhoneUpdateMany).not.toHaveBeenCalled();

      // But deleteMany still called to clean up secondary
      expect(mocks.personPhoneDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.personEmailDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.personAddressDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.personUrlDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.personIMDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.personLocationDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.personCustomFieldDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
      expect(mocks.importantDateDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
    });
  });

  // ─── Group transfer ────────────────────────────────────────────

  describe('group transfer', () => {
    it('transfers groups the primary does not have', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        groups: [{ groupId: 'group-a', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        groups: [
          { groupId: 'group-a', personId: SECONDARY_ID }, // already on primary
          { groupId: 'group-b', personId: SECONDARY_ID }, // new
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personGroupCreateMany).toHaveBeenCalledWith({
        data: [{ personId: PRIMARY_ID, groupId: 'group-b' }],
      });
    });

    it('skips group creation when primary already has all groups', async () => {
      const primary = makePerson({
        id: PRIMARY_ID,
        groups: [{ groupId: 'group-a', personId: PRIMARY_ID }],
      });
      const secondary = makePerson({
        id: SECONDARY_ID,
        groups: [{ groupId: 'group-a', personId: SECONDARY_ID }],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personGroupCreateMany).not.toHaveBeenCalled();
    });
  });

  // ─── Relationship transfer ─────────────────────────────────────

  describe('relationship transfer', () => {
    it('transfers all relationshipsFrom (re-parents personId to primary)', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        relationshipsFrom: [
          { id: 'rel-1', personId: SECONDARY_ID, relatedPersonId: PERSON_3_ID, relationshipTypeId: 'rt-1' },
          { id: 'rel-2', personId: SECONDARY_ID, relatedPersonId: PERSON_4_ID, relationshipTypeId: 'rt-2' },
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.relationshipUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['rel-1', 'rel-2'] } },
        data: { personId: PRIMARY_ID },
      });
    });

    it('transfers all relationshipsTo (re-parents relatedPersonId to primary)', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        relationshipsTo: [
          { id: 'rel-3', personId: PERSON_5_ID, relatedPersonId: SECONDARY_ID, relationshipTypeId: 'rt-1' },
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.relationshipUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['rel-3'] } },
        data: { relatedPersonId: PRIMARY_ID },
      });
    });

    it('skips self-referential relationships (secondary↔primary)', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        relationshipsFrom: [
          { id: 'rel-self', personId: SECONDARY_ID, relatedPersonId: PRIMARY_ID, relationshipTypeId: 'rt-1' },
          { id: 'rel-ok', personId: SECONDARY_ID, relatedPersonId: PERSON_3_ID, relationshipTypeId: 'rt-2' },
        ],
        relationshipsTo: [
          { id: 'rel-self-2', personId: PRIMARY_ID, relatedPersonId: SECONDARY_ID, relationshipTypeId: 'rt-1' },
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Only rel-ok should be transferred for relationshipsFrom
      const fromCall = mocks.relationshipUpdateMany.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, Record<string, unknown>>).data.personId === PRIMARY_ID
      );
      expect(fromCall).toBeDefined();
      expect(fromCall![0].where.id.in).toEqual(['rel-ok']);

      // No relationshipsTo should be transferred (rel-self-2 is self-ref)
      const toCall = mocks.relationshipUpdateMany.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, Record<string, unknown>>).data.relatedPersonId === PRIMARY_ID
      );
      expect(toCall).toBeUndefined();
    });

    it('soft-deletes leftover self-ref relationships', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        relationshipsFrom: [
          { id: 'rel-self', personId: SECONDARY_ID, relatedPersonId: PRIMARY_ID, relationshipTypeId: 'rt-1' },
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // The self-ref should be soft-deleted (not hard-deleted)
      const softDeleteCall = mocks.relationshipUpdateMany.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, Record<string, unknown>>).data.deletedAt instanceof Date
      );
      expect(softDeleteCall).toBeDefined();
      expect(softDeleteCall![0].where.id.in).toContain('rel-self');
    });

    it('transfers all relationships when primary has none and secondary has some', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        relationshipsFrom: [
          { id: 'rel-1', personId: SECONDARY_ID, relatedPersonId: PERSON_3_ID, relationshipTypeId: 'rt-1' },
        ],
        relationshipsTo: [
          { id: 'rel-2', personId: PERSON_4_ID, relatedPersonId: SECONDARY_ID, relationshipTypeId: 'rt-2' },
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Both transferred
      expect(mocks.relationshipUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['rel-1'] } },
        data: { personId: PRIMARY_ID },
      });
      expect(mocks.relationshipUpdateMany).toHaveBeenCalledWith({
        where: { id: { in: ['rel-2'] } },
        data: { relatedPersonId: PRIMARY_ID },
      });
    });

    it('skips duplicate relationships when both contacts relate to the same person', async () => {
      // Primary already has a relationship with PERSON_3
      const primary = makePerson({
        id: PRIMARY_ID,
        relationshipsFrom: [
          { id: 'rel-primary-3', personId: PRIMARY_ID, relatedPersonId: PERSON_3_ID, relationshipTypeId: 'rt-1' },
        ],
        relationshipsTo: [
          { id: 'rel-4-primary', personId: PERSON_4_ID, relatedPersonId: PRIMARY_ID, relationshipTypeId: 'rt-2' },
        ],
      });

      // Secondary also has relationships with the same people + one unique one
      const secondary = makePerson({
        id: SECONDARY_ID,
        relationshipsFrom: [
          { id: 'rel-dup-3', personId: SECONDARY_ID, relatedPersonId: PERSON_3_ID, relationshipTypeId: 'rt-1' },
          { id: 'rel-unique-5', personId: SECONDARY_ID, relatedPersonId: PERSON_5_ID, relationshipTypeId: 'rt-3' },
        ],
        relationshipsTo: [
          { id: 'rel-dup-4', personId: PERSON_4_ID, relatedPersonId: SECONDARY_ID, relationshipTypeId: 'rt-2' },
        ],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Only rel-unique-5 should be transferred (rel-dup-3 duplicates primary's rel to PERSON_3)
      const fromCall = mocks.relationshipUpdateMany.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, Record<string, unknown>>).data.personId === PRIMARY_ID
      );
      expect(fromCall).toBeDefined();
      expect(fromCall![0].where.id.in).toEqual(['rel-unique-5']);

      // No relationshipsTo should be transferred (rel-dup-4 duplicates primary's rel from PERSON_4)
      const toCall = mocks.relationshipUpdateMany.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, Record<string, unknown>>).data.relatedPersonId === PRIMARY_ID
      );
      expect(toCall).toBeUndefined();

      // Duplicates should be soft-deleted as leftovers
      const softDeleteCall = mocks.relationshipUpdateMany.mock.calls.find(
        (c: unknown[]) => (c[0] as Record<string, Record<string, unknown>>).data.deletedAt instanceof Date
      );
      expect(softDeleteCall).toBeDefined();
      expect(softDeleteCall![0].where.id.in).toContain('rel-dup-3');
      expect(softDeleteCall![0].where.id.in).toContain('rel-dup-4');
    });
  });

  // ─── CardDAV cleanup ───────────────────────────────────────────

  describe('CardDAV cleanup', () => {
    it('deletes vCard from server using deleteVCardDirect when secondary has mapping', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        cardDavMapping: {
          id: 'cdm-1',
          href: 'https://carddav.example.com/contacts/b.vcf',
          etag: '"etag-b"',
          connectionId: 'conn-1',
          uid: 'uid-b',
          connection: { id: 'conn-1' },
        },
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);
      mocks.deleteVCardDirect.mockResolvedValue(undefined);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Should use deleteVCardDirect (no full client creation needed)
      expect(mocks.deleteVCardDirect).toHaveBeenCalledWith(
        { id: 'conn-1' },
        'https://carddav.example.com/contacts/b.vcf',
        '"etag-b"',
      );

      // CardDAV mapping cleaned up inside transaction via deleteMany
      expect(mocks.cardDavMappingDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
    });

    it('retries with wildcard etag when first delete fails', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        cardDavMapping: {
          id: 'cdm-1',
          href: 'https://carddav.example.com/contacts/b.vcf',
          etag: '"stale-etag"',
          connectionId: 'conn-1',
          uid: 'uid-b',
          connection: { id: 'conn-1' },
        },
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      // First call fails (etag mismatch), second call succeeds (wildcard)
      mocks.deleteVCardDirect
        .mockRejectedValueOnce(new Error('412 Precondition Failed'))
        .mockResolvedValueOnce(undefined);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // First call with original etag, second with wildcard
      expect(mocks.deleteVCardDirect).toHaveBeenCalledTimes(2);
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(1,
        { id: 'conn-1' },
        'https://carddav.example.com/contacts/b.vcf',
        '"stale-etag"',
      );
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(2,
        { id: 'conn-1' },
        'https://carddav.example.com/contacts/b.vcf',
        '*',
      );
    });

    it('continues merge even if all CardDAV delete attempts fail', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        cardDavMapping: {
          id: 'cdm-1',
          href: 'https://carddav.example.com/contacts/b.vcf',
          etag: '"etag-b"',
          connectionId: 'conn-1',
          uid: 'uid-b',
          connection: { id: 'conn-1' },
        },
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      // Both direct attempts fail (non-404 error, so no UID fallback)
      mocks.deleteVCardDirect.mockRejectedValue(new Error('Server unreachable'));

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      // Merge still succeeds
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.mergedInto).toBe(PRIMARY_ID);
    });

    it('falls back to UID-based lookup when delete returns 404', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        cardDavMapping: {
          id: 'cdm-1',
          href: 'https://carddav.example.com/contacts/wrong-url.vcf',
          etag: '"etag-b"',
          connectionId: 'conn-1',
          uid: 'uid-b',
          connection: { id: 'conn-1' },
        },
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      // Both direct href-based deletes fail with 404
      mocks.deleteVCardDirect
        .mockRejectedValueOnce(new Error('CardDAV DELETE failed: 404 Not Found'))
        .mockRejectedValueOnce(new Error('CardDAV DELETE failed: 404 Not Found'))
        // Third call succeeds (UID-based delete at correct URL)
        .mockResolvedValueOnce(undefined);

      const mockAddressBook = { url: 'https://carddav.example.com/contacts/', raw: {} };
      mocks.mockFetchAddressBooks.mockResolvedValueOnce([mockAddressBook]);
      mocks.mockFetchVCards.mockResolvedValueOnce([
        { url: 'https://carddav.example.com/contacts/correct-url.vcf', etag: '"etag-actual"', data: 'BEGIN:VCARD\nUID:uid-b\nEND:VCARD' },
        { url: 'https://carddav.example.com/contacts/other.vcf', etag: '"etag-other"', data: 'BEGIN:VCARD\nUID:uid-other\nEND:VCARD' },
      ]);

      mocks.createCardDavClient.mockResolvedValueOnce({
        fetchAddressBooks: mocks.mockFetchAddressBooks,
        fetchVCards: mocks.mockFetchVCards,
      });

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // deleteVCardDirect called 3 times: etag, wildcard, then UID-based correct URL
      expect(mocks.deleteVCardDirect).toHaveBeenCalledTimes(3);
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(3,
        { id: 'conn-1' },
        'https://carddav.example.com/contacts/correct-url.vcf',
        '*',
      );
    });

    it('skips CardDAV deletion when secondary has no mapping', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID, cardDavMapping: null });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.deleteVCardDirect).not.toHaveBeenCalled();
      // deleteMany is always called (unconditional cleanup)
      expect(mocks.cardDavMappingDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
    });

    it('cleans up race-condition mapping created by auto-export during merge', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID, cardDavMapping: null });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      // Auto-export created a mapping between the initial fetch and the transaction
      const raceMapping = {
        id: 'cdm-race',
        personId: SECONDARY_ID,
        href: 'https://carddav.example.com/contacts/abc.vcf',
        etag: '"etag-123"',
        connectionId: 'conn-1',
      };
      mocks.cardDavMappingFindUnique.mockResolvedValueOnce(raceMapping);

      // Mock the connection lookup and client for post-transaction cleanup
      mocks.mockDeleteVCard.mockResolvedValue(undefined);
      mocks.cardDavConnectionFindUnique.mockResolvedValueOnce({ id: 'conn-1' });
      mocks.createCardDavClient.mockResolvedValueOnce({ deleteVCard: mocks.mockDeleteVCard });

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Should have found the race-condition mapping inside the transaction
      expect(mocks.cardDavMappingFindUnique).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });

      // Should have cleaned up the mapping
      expect(mocks.cardDavMappingDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });

      // Should have deleted the vCard from the server after the transaction
      expect(mocks.mockDeleteVCard).toHaveBeenCalledWith({
        url: 'https://carddav.example.com/contacts/abc.vcf',
        etag: '"etag-123"',
        data: '',
      });
    });
  });

  // ─── Secondary contact cleanup ─────────────────────────────────

  describe('secondary contact cleanup', () => {
    it('soft-deletes secondary (sets deletedAt)', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);

      // Should soft-delete secondary, not hard-delete
      const updateCall = mocks.personUpdate.mock.calls.find(
        (c: unknown[]) => {
          const arg = c[0] as Record<string, Record<string, unknown>>;
          return arg.where.id === SECONDARY_ID && arg.data.deletedAt instanceof Date;
        }
      );
      expect(updateCall).toBeDefined();
    });

    it('deletes secondary group memberships', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({
        id: SECONDARY_ID,
        groups: [{ groupId: 'group-a', personId: SECONDARY_ID }],
      });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.personGroupDeleteMany).toHaveBeenCalledWith({
        where: { personId: SECONDARY_ID },
      });
    });

    it('returns the merged primary ID on success', async () => {
      const primary = makePerson({ id: PRIMARY_ID });
      const secondary = makePerson({ id: SECONDARY_ID });

      mocks.personFindUnique.mockResolvedValueOnce(primary);
      mocks.personFindUnique.mockResolvedValueOnce(secondary);

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.mergedInto).toBe(PRIMARY_ID);
    });
  });
});
