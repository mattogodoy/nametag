/**
 * Unit tests for CardDAV sync engine (lib/carddav/sync.ts)
 *
 * Focuses on the syncFromServer mapping lookup logic, including
 * the href-based fallback when UID-based lookup fails (e.g., when
 * the server rewrites vCard UIDs after export).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => ({
  // Prisma
  cardDavConnectionFindUnique: vi.fn(),
  cardDavConnectionUpdate: vi.fn(),
  cardDavMappingFindFirst: vi.fn(),
  cardDavMappingFindMany: vi.fn(),
  cardDavMappingCreate: vi.fn(),
  cardDavMappingUpdate: vi.fn(),
  cardDavPendingImportUpsert: vi.fn(),
  cardDavPendingImportCount: vi.fn(),
  cardDavConflictCreate: vi.fn(),
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  personPhoneDeleteMany: vi.fn(),
  personEmailDeleteMany: vi.fn(),
  personAddressDeleteMany: vi.fn(),
  personUrlDeleteMany: vi.fn(),
  personIMDeleteMany: vi.fn(),
  personLocationDeleteMany: vi.fn(),
  personCustomFieldDeleteMany: vi.fn(),
  $transaction: vi.fn(),

  // CardDAV client
  fetchAddressBooks: vi.fn(),
  fetchVCards: vi.fn(),
  createVCard: vi.fn(),
  updateVCard: vi.fn(),

  // vCard
  vCardToPerson: vi.fn(),
  personToVCard: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: {
      findUnique: mocks.cardDavConnectionFindUnique,
      update: mocks.cardDavConnectionUpdate,
    },
    cardDavMapping: {
      findFirst: mocks.cardDavMappingFindFirst,
      findMany: mocks.cardDavMappingFindMany,
      create: mocks.cardDavMappingCreate,
      update: mocks.cardDavMappingUpdate,
    },
    cardDavPendingImport: {
      upsert: mocks.cardDavPendingImportUpsert,
      count: mocks.cardDavPendingImportCount,
    },
    cardDavConflict: {
      create: mocks.cardDavConflictCreate,
    },
    person: {
      findMany: mocks.personFindMany,
      update: mocks.personUpdate,
    },
    personPhone: { deleteMany: mocks.personPhoneDeleteMany },
    personEmail: { deleteMany: mocks.personEmailDeleteMany },
    personAddress: { deleteMany: mocks.personAddressDeleteMany },
    personUrl: { deleteMany: mocks.personUrlDeleteMany },
    personIM: { deleteMany: mocks.personIMDeleteMany },
    personLocation: { deleteMany: mocks.personLocationDeleteMany },
    personCustomField: { deleteMany: mocks.personCustomFieldDeleteMany },
    $transaction: mocks.$transaction,
  },
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: vi.fn(() =>
    Promise.resolve({
      fetchAddressBooks: mocks.fetchAddressBooks,
      fetchVCards: mocks.fetchVCards,
      createVCard: mocks.createVCard,
      updateVCard: mocks.updateVCard,
    })
  ),
}));

vi.mock('@/lib/vcard', () => ({
  personToVCard: mocks.personToVCard,
  vCardToPerson: mocks.vCardToPerson,
}));

// Make withRetry just call the function immediately (no actual retries in tests)
vi.mock('@/lib/carddav/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  categorizeError: vi.fn((error: unknown) => ({
    category: 'UNKNOWN',
    userMessage: error instanceof Error ? error.message : 'Unknown error',
  })),
}));

vi.mock('@/lib/photo-storage', () => ({
  savePhoto: vi.fn(),
  readPhotoForExport: vi.fn(),
  isPhotoFilename: vi.fn(() => false),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-uuid'),
}));

// --- Import after mocks ---
import { syncFromServer, syncToServer, bidirectionalSync } from '@/lib/carddav/sync';

// --- Test data helpers ---

const CONNECTION_ID = 'conn-1';
const USER_ID = 'user-1';

function makeConnection() {
  return {
    id: CONNECTION_ID,
    userId: USER_ID,
    serverUrl: 'https://carddav.example.com',
    username: 'test',
    password: 'encrypted-password',
    syncEnabled: true,
    autoExportNew: false,
    autoSyncInterval: 300,
    importMode: 'manual',
    syncToken: null,
    lastSyncAt: null,
    lastError: null,
    lastErrorAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeAddressBook() {
  return {
    url: 'https://carddav.example.com/addressbooks/default/',
    displayName: 'Contacts',
    syncToken: 'sync-token-1',
    raw: {},
  };
}

function makeVCard(uid: string, url: string, etag: string, name: string) {
  return {
    url,
    etag,
    data: `BEGIN:VCARD\nVERSION:3.0\nUID:${uid}\nFN:${name}\nN:${name};;;;\nEND:VCARD`,
  };
}

function makeParsedVCard(uid: string, name: string) {
  return {
    uid,
    name,
    surname: undefined,
    phoneNumbers: [],
    emails: [],
    addresses: [],
    urls: [],
    imHandles: [],
    locations: [],
    importantDates: [],
    categories: [],
    customFields: [],
  };
}

function makeMapping(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: 'mapping-1',
    connectionId: CONNECTION_ID,
    personId: 'person-1',
    uid: 'local-uid-1',
    href: 'https://carddav.example.com/contacts/local-uid-1.vcf',
    etag: 'etag-old',
    syncStatus: 'synced',
    lastSyncedAt: new Date('2025-01-01'),
    lastLocalChange: null,
    lastRemoteChange: null,
    localVersion: null,
    remoteVersion: null,
    person: {
      id: 'person-1',
      userId: USER_ID,
      name: 'John',
      surname: 'Doe',
      uid: 'local-uid-1',
      phoneNumbers: [],
      emails: [],
      addresses: [],
      urls: [],
      imHandles: [],
      locations: [],
      customFields: [],
    },
    ...overrides,
  };
}

// --- Tests ---

describe('CardDAV Sync Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: connection exists
    mocks.cardDavConnectionFindUnique.mockResolvedValue(makeConnection());
    mocks.cardDavConnectionUpdate.mockResolvedValue({});

    // Default: one address book
    mocks.fetchAddressBooks.mockResolvedValue([makeAddressBook()]);

    // Default: no pending imports in DB
    mocks.cardDavPendingImportCount.mockResolvedValue(0);

    // Default: mapping operations succeed
    mocks.cardDavMappingUpdate.mockResolvedValue({});
    mocks.cardDavMappingCreate.mockResolvedValue({});
    mocks.cardDavPendingImportUpsert.mockResolvedValue({});
    mocks.personUpdate.mockResolvedValue({});

    // Default: no unmapped persons for syncToServer
    mocks.cardDavMappingFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([]);

    // Default: personToVCard returns a valid vCard string
    mocks.personToVCard.mockReturnValue('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD');
  });

  describe('syncFromServer', () => {
    describe('mapping lookup', () => {
      it('should find mapping by UID and not create a pending import', async () => {
        const serverUid = 'server-uid-1';
        const vCard = makeVCard(serverUid, '/contacts/1.vcf', 'etag-1', 'Alice');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Alice'));

        // UID lookup succeeds on first call
        const mapping = makeMapping({ uid: serverUid, etag: 'etag-1' });
        mocks.cardDavMappingFindFirst.mockResolvedValue(mapping);

        const result = await syncFromServer(USER_ID);

        // Should not create a pending import
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.errors).toBe(0);
      });

      it('should fall back to href lookup when UID lookup fails', async () => {
        const localUid = 'local-uid-1';
        const serverUid = 'google-rewritten-uid';
        const href = 'https://carddav.example.com/contacts/local-uid-1.vcf';

        const vCard = makeVCard(serverUid, href, 'etag-new', 'Bob');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Bob'));

        const mapping = makeMapping({ uid: localUid, href, etag: 'etag-new' });

        // First call (UID lookup) → no match
        // Second call (href fallback) → match found
        mocks.cardDavMappingFindFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mapping);

        const result = await syncFromServer(USER_ID);

        // Should have made two findFirst calls
        expect(mocks.cardDavMappingFindFirst).toHaveBeenCalledTimes(2);

        // First call: lookup by UID
        expect(mocks.cardDavMappingFindFirst).toHaveBeenNthCalledWith(
          1,
          expect.objectContaining({
            where: { connectionId: CONNECTION_ID, uid: serverUid },
          })
        );

        // Second call: lookup by href
        expect(mocks.cardDavMappingFindFirst).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({
            where: { connectionId: CONNECTION_ID, href },
          })
        );

        // Should NOT create a pending import
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.errors).toBe(0);
      });

      it('should update mapping and person UID when href fallback matches', async () => {
        const localUid = 'local-uid-1';
        const serverUid = 'google-rewritten-uid';
        const href = 'https://carddav.example.com/contacts/local-uid-1.vcf';
        const mappingId = 'mapping-42';
        const personId = 'person-42';

        const vCard = makeVCard(serverUid, href, 'etag-same', 'Carol');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Carol'));

        const mapping = makeMapping({
          id: mappingId,
          personId,
          uid: localUid,
          href,
          etag: 'etag-same',
        });

        // UID lookup fails, href lookup succeeds
        mocks.cardDavMappingFindFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(mapping);

        await syncFromServer(USER_ID);

        // Should update mapping UID to match server
        expect(mocks.cardDavMappingUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: mappingId },
            data: { uid: serverUid },
          })
        );

        // Should update person UID to match server
        expect(mocks.personUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: personId },
            data: { uid: serverUid },
          })
        );
      });

      it('should create pending import when both UID and href lookups fail', async () => {
        const serverUid = 'completely-new-uid';
        const href = 'https://carddav.example.com/contacts/new.vcf';

        const vCard = makeVCard(serverUid, href, 'etag-1', 'Dave');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Dave'));

        // Both lookups fail
        mocks.cardDavMappingFindFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null);

        mocks.cardDavPendingImportCount.mockResolvedValue(1);

        const result = await syncFromServer(USER_ID);

        // Should create a pending import
        expect(mocks.cardDavPendingImportUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              connectionId_uid: {
                connectionId: CONNECTION_ID,
                uid: serverUid,
              },
            },
            create: expect.objectContaining({
              connectionId: CONNECTION_ID,
              uid: serverUid,
              href,
              displayName: 'Dave',
            }),
          })
        );

        expect(result.pendingImports).toBe(1);
      });

      it('should skip vCards with no UID', async () => {
        const vCard = makeVCard('', '/contacts/no-uid.vcf', 'etag-1', 'NoUid');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(
          makeParsedVCard(undefined as unknown as string, 'NoUid')
        );

        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(mocks.cardDavMappingFindFirst).not.toHaveBeenCalled();
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.errors).toBe(1);
      });
    });

    describe('conflict detection', () => {
      it('should detect conflict when both local and remote changed', async () => {
        const uid = 'conflict-uid';
        const vCard = makeVCard(uid, '/contacts/conflict.vcf', 'etag-new', 'Eve');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Eve'));

        const mapping = makeMapping({
          uid,
          etag: 'etag-old', // different from vCard → remote changed
          lastLocalChange: new Date('2025-02-01'), // after lastSyncedAt → local changed
          lastSyncedAt: new Date('2025-01-01'),
        });
        mocks.cardDavMappingFindFirst.mockResolvedValue(mapping);
        mocks.cardDavConflictCreate.mockResolvedValue({});
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(mocks.cardDavConflictCreate).toHaveBeenCalledTimes(1);
        expect(result.conflicts).toBe(1);
      });

      it('should update locally when only remote changed', async () => {
        const uid = 'update-uid';
        const vCard = makeVCard(uid, '/contacts/update.vcf', 'etag-new', 'Frank');
        mocks.fetchVCards.mockResolvedValue([vCard]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Frank'));

        const mapping = makeMapping({
          uid,
          etag: 'etag-old', // different → remote changed
          lastLocalChange: null, // no local changes
          lastSyncedAt: new Date('2025-01-01'),
        });
        mocks.cardDavMappingFindFirst.mockResolvedValue(mapping);
        mocks.$transaction.mockResolvedValue([]);
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(result.updatedLocally).toBe(1);
        expect(mocks.cardDavConflictCreate).not.toHaveBeenCalled();
      });
    });

    describe('exported contacts scenario', () => {
      it('should not re-import contacts that were just exported (UID rewrite)', async () => {
        // Simulate: 2 server contacts + 1 exported contact with rewritten UID
        const serverVCards = [
          makeVCard('server-uid-1', '/contacts/s1.vcf', 'etag-s1', 'ServerContact1'),
          makeVCard('server-uid-2', '/contacts/s2.vcf', 'etag-s2', 'ServerContact2'),
          makeVCard(
            'google-rewritten-uid',
            'https://carddav.example.com/contacts/exported.vcf',
            'etag-exported',
            'ExportedContact'
          ),
        ];
        mocks.fetchVCards.mockResolvedValue(serverVCards);

        mocks.vCardToPerson
          .mockReturnValueOnce(makeParsedVCard('server-uid-1', 'ServerContact1'))
          .mockReturnValueOnce(makeParsedVCard('server-uid-2', 'ServerContact2'))
          .mockReturnValueOnce(makeParsedVCard('google-rewritten-uid', 'ExportedContact'));

        const exportedMapping = makeMapping({
          uid: 'original-local-uid',
          href: 'https://carddav.example.com/contacts/exported.vcf',
          etag: 'etag-exported',
        });

        // For server-uid-1: UID lookup fails, href lookup fails → pending import
        // For server-uid-2: UID lookup fails, href lookup fails → pending import
        // For google-rewritten-uid: UID lookup fails, href lookup SUCCEEDS → not a pending import
        mocks.cardDavMappingFindFirst
          // server-uid-1: UID lookup
          .mockResolvedValueOnce(null)
          // server-uid-1: href lookup
          .mockResolvedValueOnce(null)
          // server-uid-2: UID lookup
          .mockResolvedValueOnce(null)
          // server-uid-2: href lookup
          .mockResolvedValueOnce(null)
          // google-rewritten-uid: UID lookup
          .mockResolvedValueOnce(null)
          // google-rewritten-uid: href lookup → match!
          .mockResolvedValueOnce(exportedMapping);

        mocks.cardDavPendingImportCount.mockResolvedValue(2);

        const result = await syncFromServer(USER_ID);

        // Only 2 pending imports (the genuine server contacts), not 3
        expect(mocks.cardDavPendingImportUpsert).toHaveBeenCalledTimes(2);
        expect(result.pendingImports).toBe(2);
      });
    });

    it('should throw when no connection exists', async () => {
      mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

      await expect(syncFromServer(USER_ID)).rejects.toThrow(
        'CardDAV connection not found'
      );
    });

    it('should throw when no address books found', async () => {
      mocks.fetchAddressBooks.mockResolvedValue([]);

      await expect(syncFromServer(USER_ID)).rejects.toThrow();
    });
  });

  describe('syncToServer', () => {
    describe('unmapped contacts export', () => {
      it('should export unmapped persons and create mappings', async () => {
        // No existing mappings
        mocks.cardDavMappingFindMany.mockResolvedValue([]);

        const unmappedPerson = {
          id: 'person-new',
          userId: USER_ID,
          name: 'Grace',
          surname: 'Hopper',
          uid: null,
          photo: null,
          phoneNumbers: [],
          emails: [],
          addresses: [],
          urls: [],
          imHandles: [],
          locations: [],
          customFields: [],
          importantDates: [],
          relationshipsFrom: [],
          groups: [],
        };
        mocks.personFindMany.mockResolvedValue([unmappedPerson]);

        mocks.createVCard.mockResolvedValue({
          url: 'https://carddav.example.com/contacts/generated-uuid.vcf',
          etag: 'new-etag',
          data: 'vcard-data',
        });

        const result = await syncToServer(USER_ID);

        // Should have assigned a UID
        expect(mocks.personUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'person-new' },
            data: { uid: 'generated-uuid' },
          })
        );

        // Should have created a mapping
        expect(mocks.cardDavMappingCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              connectionId: CONNECTION_ID,
              personId: 'person-new',
              uid: 'generated-uuid',
              href: 'https://carddav.example.com/contacts/generated-uuid.vcf',
              syncStatus: 'synced',
            }),
          })
        );

        expect(result.exported).toBe(1);
      });

      it('should use existing UID when person already has one', async () => {
        mocks.cardDavMappingFindMany.mockResolvedValue([]);

        const personWithUid = {
          id: 'person-existing-uid',
          userId: USER_ID,
          name: 'Ada',
          surname: 'Lovelace',
          uid: 'existing-uid-456',
          photo: null,
          phoneNumbers: [],
          emails: [],
          addresses: [],
          urls: [],
          imHandles: [],
          locations: [],
          customFields: [],
          importantDates: [],
          relationshipsFrom: [],
          groups: [],
        };
        mocks.personFindMany.mockResolvedValue([personWithUid]);

        mocks.createVCard.mockResolvedValue({
          url: 'https://carddav.example.com/contacts/existing-uid-456.vcf',
          etag: 'new-etag',
          data: 'vcard-data',
        });

        await syncToServer(USER_ID);

        // Should NOT update person (uid already exists)
        expect(mocks.personUpdate).not.toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'person-existing-uid' },
            data: expect.objectContaining({ uid: expect.anything() }),
          })
        );

        // Should use existing UID in mapping
        expect(mocks.cardDavMappingCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              uid: 'existing-uid-456',
            }),
          })
        );
      });
    });
  });

  describe('bidirectionalSync', () => {
    it('should run pull then push and combine results', async () => {
      // Pull: 2 new server contacts
      const serverVCards = [
        makeVCard('uid-1', '/contacts/1.vcf', 'etag-1', 'Contact1'),
        makeVCard('uid-2', '/contacts/2.vcf', 'etag-2', 'Contact2'),
      ];
      mocks.fetchVCards.mockResolvedValue(serverVCards);
      mocks.vCardToPerson
        .mockReturnValueOnce(makeParsedVCard('uid-1', 'Contact1'))
        .mockReturnValueOnce(makeParsedVCard('uid-2', 'Contact2'));

      // No existing mappings for any vCard
      mocks.cardDavMappingFindFirst
        .mockResolvedValueOnce(null) // uid-1 UID lookup
        .mockResolvedValueOnce(null) // uid-1 href lookup
        .mockResolvedValueOnce(null) // uid-2 UID lookup
        .mockResolvedValueOnce(null); // uid-2 href lookup

      mocks.cardDavPendingImportCount.mockResolvedValue(2);

      // Push: 1 unmapped local contact
      mocks.cardDavMappingFindMany.mockResolvedValue([]);
      const localPerson = {
        id: 'local-1',
        userId: USER_ID,
        name: 'Local',
        surname: 'Person',
        uid: 'local-person-uid',
        photo: null,
        phoneNumbers: [],
        emails: [],
        addresses: [],
        urls: [],
        imHandles: [],
        locations: [],
        customFields: [],
        importantDates: [],
        relationshipsFrom: [],
        groups: [],
      };
      mocks.personFindMany.mockResolvedValue([localPerson]);
      mocks.createVCard.mockResolvedValue({
        url: '/contacts/local.vcf',
        etag: 'local-etag',
        data: 'vcard',
      });

      const result = await bidirectionalSync(USER_ID);

      expect(result.pendingImports).toBe(2);
      expect(result.exported).toBe(1);
      expect(result.errors).toBe(0);
    });
  });
});
