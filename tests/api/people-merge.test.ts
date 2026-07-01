import { describe, it, expect, beforeEach, vi } from 'vitest';

// Valid CUID constants for test IDs
const PRIMARY_ID = 'clprimary00000000000000001';
const SECONDARY_ID = 'clsecondary000000000000001';
const SAME_ID = 'clsame000000000000000000001';
const USER_ID = 'cluser00000000000000000001';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  // prisma mocks (only what the route uses directly)
  cardDavMappingFindUnique: vi.fn(),
  cardDavMappingUpdate: vi.fn(),
  personFindUnique: vi.fn(),

  // Service mock
  mergePeople: vi.fn(),

  // CardDAV mocks
  createCardDavClient: vi.fn(),
  deleteVCardDirect: vi.fn(),
  mockFetchAddressBooks: vi.fn(),
  mockFetchVCards: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavMapping: {
      findUnique: mocks.cardDavMappingFindUnique,
      update: mocks.cardDavMappingUpdate,
    },
    person: {
      findUnique: mocks.personFindUnique,
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: USER_ID, email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('@/lib/services/person', () => ({
  mergePeople: mocks.mergePeople,
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: mocks.createCardDavClient,
  deleteVCardDirect: mocks.deleteVCardDirect,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  createModuleLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Import after mocking
import { POST } from '@/app/api/people/merge/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/people/merge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/people/merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no CardDAV mappings, secondary exists, merge succeeds
    mocks.cardDavMappingFindUnique.mockResolvedValue(null);
    mocks.personFindUnique.mockResolvedValue({
      id: SECONDARY_ID,
      name: 'Jane',
      surname: 'Doe',
      displayNameOverride: null,
      cardDavMapping: null,
    });
    mocks.mergePeople.mockResolvedValue(PRIMARY_ID);
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

    it('returns 404 when mergePeople returns null (person not found)', async () => {
      mocks.mergePeople.mockResolvedValue(null);

      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  // ─── Service delegation ────────────────────────────────────────

  describe('service delegation', () => {
    it('calls mergePeople with correct arguments', async () => {
      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
        fieldOverrides: { name: 'Jane', surname: 'Smith' },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mocks.mergePeople).toHaveBeenCalledWith(
        PRIMARY_ID,
        SECONDARY_ID,
        USER_ID,
        { name: 'Jane', surname: 'Smith' },
      );
    });

    it('calls mergePeople without overrides when not provided', async () => {
      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      await POST(request);

      expect(mocks.mergePeople).toHaveBeenCalledWith(
        PRIMARY_ID,
        SECONDARY_ID,
        USER_ID,
        undefined,
      );
    });

    it('returns the merged primary ID on success', async () => {
      const request = makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.mergedInto).toBe(PRIMARY_ID);
    });
  });

  // ─── CardDAV pre-merge: vCard deletion ──────────────────────────

  describe('CardDAV pre-merge vCard deletion', () => {
    const CONNECTION = { id: 'conn-1' };
    const MAPPING = {
      id: 'cdm-1',
      href: 'https://carddav.example.com/contacts/b.vcf',
      etag: '"etag-b"',
      connectionId: 'conn-1',
      uid: 'uid-b',
      connection: CONNECTION,
    };

    it('deletes vCard using deleteVCardDirect when secondary has mapping', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: SECONDARY_ID,
        name: 'Jane',
        surname: 'Doe',
        displayNameOverride: null,
        cardDavMapping: MAPPING,
      });
      mocks.deleteVCardDirect.mockResolvedValue(undefined);

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.deleteVCardDirect).toHaveBeenCalledWith(
        CONNECTION,
        'https://carddav.example.com/contacts/b.vcf',
        '"etag-b"',
      );
    });

    it('retries with wildcard etag when first delete fails', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: SECONDARY_ID,
        name: 'Jane',
        surname: 'Doe',
        displayNameOverride: null,
        cardDavMapping: { ...MAPPING, etag: '"stale-etag"' },
      });

      mocks.deleteVCardDirect
        .mockRejectedValueOnce(new Error('412 Precondition Failed'))
        .mockResolvedValueOnce(undefined);

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.deleteVCardDirect).toHaveBeenCalledTimes(2);
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(1,
        CONNECTION,
        'https://carddav.example.com/contacts/b.vcf',
        '"stale-etag"',
      );
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(2,
        CONNECTION,
        'https://carddav.example.com/contacts/b.vcf',
        '*',
      );
    });

    it('continues merge even if all CardDAV delete attempts fail', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: SECONDARY_ID,
        name: 'Jane',
        surname: 'Doe',
        displayNameOverride: null,
        cardDavMapping: MAPPING,
      });
      mocks.deleteVCardDirect.mockRejectedValue(new Error('Server unreachable'));

      const response = await POST(makeRequest({
        primaryId: PRIMARY_ID,
        secondaryId: SECONDARY_ID,
      }));

      expect(response.status).toBe(200);
      expect(mocks.mergePeople).toHaveBeenCalled();
    });

    it('falls back to UID-based lookup when delete returns 404', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: SECONDARY_ID,
        name: 'Jane',
        surname: 'Doe',
        displayNameOverride: null,
        cardDavMapping: MAPPING,
      });

      mocks.deleteVCardDirect
        .mockRejectedValueOnce(new Error('CardDAV DELETE failed: 404 Not Found'))
        .mockRejectedValueOnce(new Error('CardDAV DELETE failed: 404 Not Found'))
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

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.deleteVCardDirect).toHaveBeenCalledTimes(3);
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(3,
        CONNECTION,
        'https://carddav.example.com/contacts/correct-url.vcf',
        '*',
      );
    });

    it('falls back to displayNameOverride when matching by FN after delete returns 404', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: SECONDARY_ID,
        name: 'Robert',
        surname: 'Smith',
        displayNameOverride: 'Dad',
        cardDavMapping: { ...MAPPING, uid: '' },
      });

      mocks.deleteVCardDirect
        .mockRejectedValueOnce(new Error('CardDAV DELETE failed: 404 Not Found'))
        .mockRejectedValueOnce(new Error('CardDAV DELETE failed: 404 Not Found'))
        .mockResolvedValueOnce(undefined);

      const mockAddressBook = { url: 'https://carddav.example.com/contacts/', raw: {} };
      mocks.mockFetchAddressBooks.mockResolvedValueOnce([mockAddressBook]);
      mocks.mockFetchVCards.mockResolvedValueOnce([
        { url: 'https://carddav.example.com/contacts/dad.vcf', etag: '"etag-dad"', data: 'BEGIN:VCARD\nFN:Dad\nEND:VCARD' },
        { url: 'https://carddav.example.com/contacts/robert.vcf', etag: '"etag-robert"', data: 'BEGIN:VCARD\nFN:Robert Smith\nEND:VCARD' },
      ]);

      mocks.createCardDavClient.mockResolvedValueOnce({
        fetchAddressBooks: mocks.mockFetchAddressBooks,
        fetchVCards: mocks.mockFetchVCards,
      });

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.deleteVCardDirect).toHaveBeenCalledTimes(3);
      expect(mocks.deleteVCardDirect).toHaveBeenNthCalledWith(3,
        CONNECTION,
        'https://carddav.example.com/contacts/dad.vcf',
        '*',
      );
    });

    it('skips CardDAV deletion when secondary has no mapping', async () => {
      // Default mock already has no cardDavMapping
      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.deleteVCardDirect).not.toHaveBeenCalled();
    });

    it('skips CardDAV deletion when secondary person not found (pre-fetch)', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.deleteVCardDirect).not.toHaveBeenCalled();
      // Merge still called — it does its own fetch
      expect(mocks.mergePeople).toHaveBeenCalled();
    });
  });

  // ─── CardDAV post-merge: mark primary mapping as pending ───────

  describe('CardDAV post-merge', () => {
    it('marks primary CardDAV mapping as pending after merge', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue({
        id: 'cdm-primary',
        personId: PRIMARY_ID,
      });
      mocks.cardDavMappingUpdate.mockResolvedValue({});

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.cardDavMappingUpdate).toHaveBeenCalledWith({
        where: { id: 'cdm-primary' },
        data: {
          syncStatus: 'pending',
          lastLocalChange: expect.any(Date),
        },
      });
    });

    it('skips marking pending when primary has no CardDAV mapping', async () => {
      // Default mock returns null for cardDavMappingFindUnique
      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.cardDavMappingUpdate).not.toHaveBeenCalled();
    });

    it('does not mark pending when merge fails (returns null)', async () => {
      mocks.mergePeople.mockResolvedValue(null);
      mocks.cardDavMappingFindUnique.mockResolvedValue({
        id: 'cdm-primary',
        personId: PRIMARY_ID,
      });

      await POST(makeRequest({ primaryId: PRIMARY_ID, secondaryId: SECONDARY_ID }));

      expect(mocks.cardDavMappingUpdate).not.toHaveBeenCalled();
    });
  });
});
