/**
 * Unit tests for CardDAV sync engine (lib/carddav/sync.ts)
 *
 * Focuses on:
 * - Batch mapping pre-load with in-memory UID/href lookup
 * - href-based fallback when server rewrites vCard UIDs
 * - Conflict detection and local updates
 * - Unmapped contact export
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => ({
  // Prisma
  cardDavConnectionFindUnique: vi.fn(),
  cardDavConnectionUpdate: vi.fn(),
  cardDavConnectionUpdateMany: vi.fn(),
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
  importantDateDeleteMany: vi.fn(),
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
      updateMany: mocks.cardDavConnectionUpdateMany,
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
    importantDate: { deleteMany: mocks.importantDateDeleteMany },
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

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
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

/** Lightweight mapping (as returned by findMany without includes) */
function makeLightMapping(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

/** Full mapping with person includes (as returned by findFirst with include) */
function makeFullMapping(overrides: Record<string, unknown> = {}) {
  const light = makeLightMapping(overrides);
  return {
    ...light,
    person: {
      id: light.personId,
      userId: USER_ID,
      name: 'John',
      surname: 'Doe',
      uid: light.uid,
      phoneNumbers: [],
      emails: [],
      addresses: [],
      urls: [],
      imHandles: [],
      locations: [],
      customFields: [],
      ...(typeof overrides.person === 'object' ? overrides.person : {}),
    },
  };
}

// --- Tests ---

describe('CardDAV Sync Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: connection exists
    mocks.cardDavConnectionFindUnique.mockResolvedValue(makeConnection());
    mocks.cardDavConnectionUpdate.mockResolvedValue({});
    mocks.cardDavConnectionUpdateMany.mockResolvedValue({ count: 1 });

    // Default: one address book
    mocks.fetchAddressBooks.mockResolvedValue([makeAddressBook()]);

    // Default: no pending imports in DB
    mocks.cardDavPendingImportCount.mockResolvedValue(0);

    // Default: mapping operations succeed
    mocks.cardDavMappingUpdate.mockResolvedValue({});
    mocks.cardDavMappingCreate.mockResolvedValue({});
    mocks.cardDavPendingImportUpsert.mockResolvedValue({});
    mocks.personUpdate.mockResolvedValue({});

    // Default: no existing mappings (for both syncFromServer pre-load and syncToServer)
    mocks.cardDavMappingFindMany.mockResolvedValue([]);
    mocks.personFindMany.mockResolvedValue([]);

    // Default: personToVCard returns a valid vCard string
    mocks.personToVCard.mockReturnValue('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD');
  });

  describe('syncFromServer', () => {
    describe('batch mapping pre-load', () => {
      it('should load all mappings in a single query before processing vCards', async () => {
        mocks.fetchVCards.mockResolvedValue([]);
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        await syncFromServer(USER_ID);

        // Should call findMany exactly once for the pre-load
        expect(mocks.cardDavMappingFindMany).toHaveBeenCalledTimes(1);
        expect(mocks.cardDavMappingFindMany).toHaveBeenCalledWith({
          where: { connectionId: CONNECTION_ID },
        });
      });

      it('should not make per-vCard findFirst calls for unchanged contacts', async () => {
        const uid = 'existing-uid';
        const etag = 'same-etag';

        // Pre-loaded mapping with same etag as server vCard → no change
        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({ uid, etag }),
        ]);

        mocks.fetchVCards.mockResolvedValue([
          makeVCard(uid, '/contacts/1.vcf', etag, 'Alice'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Alice'));
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        await syncFromServer(USER_ID);

        // Should NOT call findFirst at all — no DB lookups per vCard
        expect(mocks.cardDavMappingFindFirst).not.toHaveBeenCalled();
        // Should NOT create pending imports
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
      });
    });

    describe('mapping lookup', () => {
      it('should find mapping by UID and not create a pending import', async () => {
        const uid = 'server-uid-1';
        const etag = 'same-etag';

        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({ uid, etag }),
        ]);
        mocks.fetchVCards.mockResolvedValue([
          makeVCard(uid, '/contacts/1.vcf', etag, 'Alice'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Alice'));
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.errors).toBe(0);
      });

      it('should fall back to href lookup when UID does not match any mapping', async () => {
        const localUid = 'local-uid-1';
        const serverUid = 'google-rewritten-uid';
        const href = 'https://carddav.example.com/contacts/local-uid-1.vcf';
        const etag = 'same-etag';

        // Pre-loaded mapping has localUid (not serverUid), but href matches
        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({ uid: localUid, href, etag }),
        ]);
        mocks.fetchVCards.mockResolvedValue([
          makeVCard(serverUid, href, etag, 'Bob'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Bob'));
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        // Should NOT create a pending import (matched by href)
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.errors).toBe(0);
      });

      it('should update mapping and person UID when matched by href', async () => {
        const localUid = 'local-uid-1';
        const serverUid = 'google-rewritten-uid';
        const href = 'https://carddav.example.com/contacts/local-uid-1.vcf';
        const mappingId = 'mapping-42';
        const personId = 'person-42';
        const etag = 'same-etag';

        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({ id: mappingId, personId, uid: localUid, href, etag }),
        ]);
        mocks.fetchVCards.mockResolvedValue([
          makeVCard(serverUid, href, etag, 'Carol'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Carol'));
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

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

      it('should create pending import when neither UID nor href matches', async () => {
        const serverUid = 'completely-new-uid';
        const href = 'https://carddav.example.com/contacts/new.vcf';

        // No mappings at all
        mocks.cardDavMappingFindMany.mockResolvedValue([]);
        mocks.fetchVCards.mockResolvedValue([
          makeVCard(serverUid, href, 'etag-1', 'Dave'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(serverUid, 'Dave'));
        mocks.cardDavPendingImportCount.mockResolvedValue(1);

        const result = await syncFromServer(USER_ID);

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
        mocks.fetchVCards.mockResolvedValue([
          makeVCard('', '/contacts/no-uid.vcf', 'etag-1', 'NoUid'),
        ]);
        mocks.vCardToPerson.mockReturnValue(
          makeParsedVCard(undefined as unknown as string, 'NoUid')
        );
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.errors).toBe(1);
      });
    });

    describe('conflict detection', () => {
      it('should detect conflict when both local and remote changed', async () => {
        const uid = 'conflict-uid';
        const mappingId = 'mapping-conflict';

        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({
            id: mappingId,
            uid,
            etag: 'etag-old',
            lastLocalChange: new Date('2025-02-01'),
            lastSyncedAt: new Date('2025-01-01'),
          }),
        ]);

        mocks.fetchVCards.mockResolvedValue([
          makeVCard(uid, '/contacts/conflict.vcf', 'etag-new', 'Eve'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Eve'));

        // findFirst called to load full person data for conflict record
        mocks.cardDavMappingFindFirst.mockResolvedValue(
          makeFullMapping({
            id: mappingId,
            uid,
            etag: 'etag-old',
            lastLocalChange: new Date('2025-02-01'),
            lastSyncedAt: new Date('2025-01-01'),
          })
        );
        mocks.cardDavConflictCreate.mockResolvedValue({});
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(mocks.cardDavConflictCreate).toHaveBeenCalledTimes(1);
        expect(result.conflicts).toBe(1);
      });

      it('should update locally when only remote changed', async () => {
        const uid = 'update-uid';
        const mappingId = 'mapping-update';

        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({
            id: mappingId,
            uid,
            etag: 'etag-old',
            lastLocalChange: null,
            lastSyncedAt: new Date('2025-01-01'),
          }),
        ]);

        mocks.fetchVCards.mockResolvedValue([
          makeVCard(uid, '/contacts/update.vcf', 'etag-new', 'Frank'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Frank'));

        // findFirst called to load full person data for update
        mocks.cardDavMappingFindFirst.mockResolvedValue(
          makeFullMapping({
            id: mappingId,
            uid,
            etag: 'etag-old',
            lastLocalChange: null,
            lastSyncedAt: new Date('2025-01-01'),
          })
        );
        mocks.$transaction.mockResolvedValue([]);
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        expect(result.updatedLocally).toBe(1);
        expect(mocks.cardDavConflictCreate).not.toHaveBeenCalled();
      });

      it('should skip DB queries entirely when neither local nor remote changed', async () => {
        const uid = 'unchanged-uid';
        const etag = 'same-etag';

        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({ uid, etag, lastLocalChange: null }),
        ]);
        mocks.fetchVCards.mockResolvedValue([
          makeVCard(uid, '/contacts/same.vcf', etag, 'Unchanged'),
        ]);
        mocks.vCardToPerson.mockReturnValue(makeParsedVCard(uid, 'Unchanged'));
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        const result = await syncFromServer(USER_ID);

        // No full-data fetch needed
        expect(mocks.cardDavMappingFindFirst).not.toHaveBeenCalled();
        // No updates, conflicts, or imports
        expect(mocks.cardDavMappingUpdate).not.toHaveBeenCalled();
        expect(mocks.cardDavConflictCreate).not.toHaveBeenCalled();
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
        expect(result.updatedLocally).toBe(0);
        expect(result.conflicts).toBe(0);
      });
    });

    describe('exported contacts scenario', () => {
      it('should not re-import contacts that were just exported (UID rewrite)', async () => {
        // Pre-loaded mapping: exported contact with local UID and known href
        const exportedHref = 'https://carddav.example.com/contacts/exported.vcf';
        mocks.cardDavMappingFindMany.mockResolvedValue([
          makeLightMapping({
            uid: 'original-local-uid',
            href: exportedHref,
            etag: 'etag-exported',
          }),
        ]);

        // Server returns: 2 new + 1 exported (with rewritten UID)
        mocks.fetchVCards.mockResolvedValue([
          makeVCard('server-uid-1', '/contacts/s1.vcf', 'etag-s1', 'ServerContact1'),
          makeVCard('server-uid-2', '/contacts/s2.vcf', 'etag-s2', 'ServerContact2'),
          makeVCard('google-rewritten-uid', exportedHref, 'etag-exported', 'ExportedContact'),
        ]);
        mocks.vCardToPerson
          .mockReturnValueOnce(makeParsedVCard('server-uid-1', 'ServerContact1'))
          .mockReturnValueOnce(makeParsedVCard('server-uid-2', 'ServerContact2'))
          .mockReturnValueOnce(makeParsedVCard('google-rewritten-uid', 'ExportedContact'));

        mocks.cardDavPendingImportCount.mockResolvedValue(2);

        const result = await syncFromServer(USER_ID);

        // Only 2 pending imports (the genuine server contacts), not 3
        expect(mocks.cardDavPendingImportUpsert).toHaveBeenCalledTimes(2);
        expect(result.pendingImports).toBe(2);
      });
    });

    describe('performance', () => {
      it('should use O(1) lookups for large contact lists', async () => {
        const mappingCount = 100;
        const mappings = Array.from({ length: mappingCount }, (_, i) =>
          makeLightMapping({
            id: `mapping-${i}`,
            uid: `uid-${i}`,
            href: `/contacts/${i}.vcf`,
            etag: `etag-${i}`,
          })
        );
        mocks.cardDavMappingFindMany.mockResolvedValue(mappings);

        // All vCards match existing mappings with same etag (no changes)
        const vCards = Array.from({ length: mappingCount }, (_, i) =>
          makeVCard(`uid-${i}`, `/contacts/${i}.vcf`, `etag-${i}`, `Contact${i}`)
        );
        mocks.fetchVCards.mockResolvedValue(vCards);
        vCards.forEach((_, i) => {
          mocks.vCardToPerson.mockReturnValueOnce(
            makeParsedVCard(`uid-${i}`, `Contact${i}`)
          );
        });
        mocks.cardDavPendingImportCount.mockResolvedValue(0);

        await syncFromServer(USER_ID);

        // Only 1 findMany call for pre-load, zero findFirst calls
        expect(mocks.cardDavMappingFindMany).toHaveBeenCalledTimes(1);
        expect(mocks.cardDavMappingFindFirst).not.toHaveBeenCalled();
        expect(mocks.cardDavPendingImportUpsert).not.toHaveBeenCalled();
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

        expect(mocks.personUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'person-new' },
            data: { uid: 'generated-uuid' },
          })
        );

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

      it('should filter unmapped persons by cardDavSyncEnabled: true', async () => {
        mocks.cardDavMappingFindMany.mockResolvedValue([]);
        mocks.personFindMany.mockResolvedValue([]);

        await syncToServer(USER_ID);

        expect(mocks.personFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: USER_ID,
              cardDavSyncEnabled: true,
            }),
          })
        );
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

        // Should NOT update person UID (already exists)
        expect(mocks.personUpdate).not.toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'person-existing-uid' },
            data: expect.objectContaining({ uid: expect.anything() }),
          })
        );

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
      // Pull: 2 new server contacts (no mappings)
      mocks.cardDavMappingFindMany.mockResolvedValue([]);

      const serverVCards = [
        makeVCard('uid-1', '/contacts/1.vcf', 'etag-1', 'Contact1'),
        makeVCard('uid-2', '/contacts/2.vcf', 'etag-2', 'Contact2'),
      ];
      mocks.fetchVCards.mockResolvedValue(serverVCards);
      mocks.vCardToPerson
        .mockReturnValueOnce(makeParsedVCard('uid-1', 'Contact1'))
        .mockReturnValueOnce(makeParsedVCard('uid-2', 'Contact2'));

      mocks.cardDavPendingImportCount.mockResolvedValue(2);

      // Push: 1 unmapped local contact
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
