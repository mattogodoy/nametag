/**
 * Unit tests for CardDAV auto-export module (lib/carddav/auto-export.ts)
 *
 * Covers:
 * - autoExportPerson: exporting a person to CardDAV server
 * - autoUpdatePerson: updating a person on CardDAV server
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => ({
  // Prisma
  personFindUnique: vi.fn(),
  personUpdate: vi.fn(),
  cardDavConnectionFindUnique: vi.fn(),
  cardDavConnectionUpdate: vi.fn(),
  cardDavMappingFindUnique: vi.fn(),
  cardDavMappingCreate: vi.fn(),
  cardDavMappingUpdate: vi.fn(),

  // CardDAV client
  fetchAddressBooks: vi.fn(),
  createVCard: vi.fn(),
  updateVCard: vi.fn(),

  // vCard
  personToVCard: vi.fn(),

  // Photo
  readPhotoForExport: vi.fn(),
  isPhotoFilename: vi.fn(),

  // Hash
  buildLocalHash: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      update: mocks.personUpdate,
    },
    cardDavConnection: {
      findUnique: mocks.cardDavConnectionFindUnique,
      update: mocks.cardDavConnectionUpdate,
    },
    cardDavMapping: {
      findUnique: mocks.cardDavMappingFindUnique,
      create: mocks.cardDavMappingCreate,
      update: mocks.cardDavMappingUpdate,
    },
  },
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: vi.fn(() =>
    Promise.resolve({
      fetchAddressBooks: mocks.fetchAddressBooks,
      createVCard: mocks.createVCard,
      updateVCard: mocks.updateVCard,
    })
  ),
}));

vi.mock('@/lib/vcard', () => ({
  personToVCard: mocks.personToVCard,
}));

vi.mock('@/lib/carddav/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/photo-storage', () => ({
  readPhotoForExport: mocks.readPhotoForExport,
  isPhotoFilename: mocks.isPhotoFilename,
}));

vi.mock('@/lib/carddav/hash', () => ({
  buildLocalHash: mocks.buildLocalHash,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'generated-uuid'),
}));

// --- Import after mocks ---
import { autoExportPerson, autoUpdatePerson } from '@/lib/carddav/auto-export';

// --- Test data helpers ---

const PERSON_ID = 'person-1';
const USER_ID = 'user-1';
const CONNECTION_ID = 'conn-1';
const MAPPING_ID = 'mapping-1';

function makePerson(overrides: Record<string, unknown> = {}) {
  return {
    id: PERSON_ID,
    userId: USER_ID,
    name: 'John',
    surname: 'Doe',
    uid: 'existing-uid-123',
    photo: null,
    cardDavSyncEnabled: true,
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
    ...overrides,
  };
}

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: CONNECTION_ID,
    userId: USER_ID,
    serverUrl: 'https://carddav.example.com',
    username: 'test',
    password: 'encrypted-password',
    syncEnabled: true,
    autoExportNew: true,
    autoSyncInterval: 300,
    importMode: 'manual',
    syncToken: null,
    lastSyncAt: null,
    lastError: null,
    lastErrorAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
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

function makeMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: MAPPING_ID,
    connectionId: CONNECTION_ID,
    personId: PERSON_ID,
    uid: 'existing-uid-123',
    href: 'https://carddav.example.com/contacts/existing-uid-123.vcf',
    etag: 'etag-1',
    syncStatus: 'synced',
    lastSyncedAt: new Date('2025-01-01'),
    lastLocalChange: null,
    lastRemoteChange: null,
    localVersion: null,
    remoteVersion: null,
    ...overrides,
  };
}

// --- Tests ---

describe('CardDAV Auto-Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Defaults
    mocks.personFindUnique.mockResolvedValue(makePerson());
    mocks.cardDavConnectionFindUnique.mockResolvedValue(makeConnection());
    mocks.cardDavMappingFindUnique.mockResolvedValue(null);
    mocks.cardDavMappingCreate.mockResolvedValue({});
    mocks.cardDavMappingUpdate.mockResolvedValue({});
    mocks.personUpdate.mockResolvedValue({});
    mocks.cardDavConnectionUpdate.mockResolvedValue({});

    mocks.fetchAddressBooks.mockResolvedValue([makeAddressBook()]);
    mocks.createVCard.mockResolvedValue({
      url: 'https://carddav.example.com/contacts/existing-uid-123.vcf',
      etag: 'new-etag',
      data: 'vcard-data',
    });
    mocks.updateVCard.mockResolvedValue({
      url: 'https://carddav.example.com/contacts/existing-uid-123.vcf',
      etag: 'updated-etag',
      data: 'vcard-data',
    });
    mocks.personToVCard.mockReturnValue('BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD');
    mocks.isPhotoFilename.mockReturnValue(false);
    mocks.readPhotoForExport.mockResolvedValue(null);
    mocks.buildLocalHash.mockReturnValue('hash-abc123');
  });

  describe('autoExportPerson', () => {
    it('should export person to CardDAV server on happy path', async () => {
      await autoExportPerson(PERSON_ID);

      // Should create vCard on server
      expect(mocks.createVCard).toHaveBeenCalledTimes(1);
      expect(mocks.createVCard).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://carddav.example.com/addressbooks/default/' }),
        'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD',
        'existing-uid-123.vcf',
      );

      // Should create mapping
      expect(mocks.cardDavMappingCreate).toHaveBeenCalledTimes(1);
      expect(mocks.cardDavMappingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          connectionId: CONNECTION_ID,
          personId: PERSON_ID,
          uid: 'existing-uid-123',
          href: 'https://carddav.example.com/contacts/existing-uid-123.vcf',
          etag: 'new-etag',
          syncStatus: 'synced',
          localVersion: 'hash-abc123',
        }),
      });
    });

    it('should throw when person is not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      await expect(autoExportPerson(PERSON_ID)).rejects.toThrow('Person not found');
    });

    it('should return early when cardDavSyncEnabled is false', async () => {
      mocks.personFindUnique.mockResolvedValue(makePerson({ cardDavSyncEnabled: false }));

      await autoExportPerson(PERSON_ID);

      expect(mocks.cardDavConnectionFindUnique).not.toHaveBeenCalled();
      expect(mocks.createVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingCreate).not.toHaveBeenCalled();
    });

    it('should return early when no CardDAV connection exists', async () => {
      mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

      await autoExportPerson(PERSON_ID);

      expect(mocks.createVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingCreate).not.toHaveBeenCalled();
    });

    it('should return early when sync is disabled', async () => {
      mocks.cardDavConnectionFindUnique.mockResolvedValue(
        makeConnection({ syncEnabled: false })
      );

      await autoExportPerson(PERSON_ID);

      expect(mocks.createVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingCreate).not.toHaveBeenCalled();
    });

    it('should return early when auto-export is disabled', async () => {
      mocks.cardDavConnectionFindUnique.mockResolvedValue(
        makeConnection({ autoExportNew: false })
      );

      await autoExportPerson(PERSON_ID);

      expect(mocks.createVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingCreate).not.toHaveBeenCalled();
    });

    it('should return early when person is already mapped', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue(makeMapping());

      await autoExportPerson(PERSON_ID);

      expect(mocks.createVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingCreate).not.toHaveBeenCalled();
    });

    it('should generate UUID and update person when person has no UID', async () => {
      mocks.personFindUnique.mockResolvedValue(makePerson({ uid: null }));
      mocks.createVCard.mockResolvedValue({
        url: 'https://carddav.example.com/contacts/generated-uuid.vcf',
        etag: 'new-etag',
        data: 'vcard-data',
      });

      await autoExportPerson(PERSON_ID);

      // Should update person with generated UUID
      expect(mocks.personUpdate).toHaveBeenCalledWith({
        where: { id: PERSON_ID },
        data: { uid: 'generated-uuid' },
      });

      // Should use generated UUID for vCard filename
      expect(mocks.createVCard).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        'generated-uuid.vcf',
      );

      // Should use generated UUID in mapping
      expect(mocks.cardDavMappingCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          uid: 'generated-uuid',
        }),
      });
    });

    it('should load photo when person has a file-based photo', async () => {
      mocks.personFindUnique.mockResolvedValue(makePerson({ photo: 'photo-abc123.jpg' }));
      mocks.isPhotoFilename.mockReturnValue(true);
      mocks.readPhotoForExport.mockResolvedValue('data:image/jpeg;base64,/9j/...');

      await autoExportPerson(PERSON_ID);

      expect(mocks.readPhotoForExport).toHaveBeenCalledWith(USER_ID, 'photo-abc123.jpg');
      expect(mocks.personToVCard).toHaveBeenCalledWith(
        expect.anything(),
        { photoDataUri: 'data:image/jpeg;base64,/9j/...' },
      );
    });

    it('should not pass photoDataUri when photo is a URL (not a filename)', async () => {
      mocks.personFindUnique.mockResolvedValue(
        makePerson({ photo: 'https://example.com/photo.jpg' })
      );
      mocks.isPhotoFilename.mockReturnValue(false);

      await autoExportPerson(PERSON_ID);

      expect(mocks.readPhotoForExport).not.toHaveBeenCalled();
      expect(mocks.personToVCard).toHaveBeenCalledWith(
        expect.anything(),
        { photoDataUri: undefined },
      );
    });

    it('should throw when no address books found on server', async () => {
      mocks.fetchAddressBooks.mockResolvedValue([]);

      await expect(autoExportPerson(PERSON_ID)).rejects.toThrow('No address books found');
    });

    it('should log error, update connection lastError, and rethrow on network error', async () => {
      const networkError = new Error('Network timeout');
      mocks.createVCard.mockRejectedValue(networkError);

      await expect(autoExportPerson(PERSON_ID)).rejects.toThrow('Network timeout');

      // Should update connection with error info
      expect(mocks.cardDavConnectionUpdate).toHaveBeenCalledWith({
        where: { id: CONNECTION_ID },
        data: {
          lastError: 'Network timeout',
          lastErrorAt: expect.any(Date),
        },
      });
    });
  });

  describe('autoUpdatePerson', () => {
    it('should update vCard on server when mapping exists and sync enabled', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue(makeMapping());

      await autoUpdatePerson(PERSON_ID);

      // Should mark as locally changed first
      expect(mocks.cardDavMappingUpdate).toHaveBeenCalledWith({
        where: { id: MAPPING_ID },
        data: {
          lastLocalChange: expect.any(Date),
          syncStatus: 'pending',
        },
      });

      // Should update vCard on server
      expect(mocks.updateVCard).toHaveBeenCalledTimes(1);
      expect(mocks.updateVCard).toHaveBeenCalledWith(
        {
          url: 'https://carddav.example.com/contacts/existing-uid-123.vcf',
          etag: 'etag-1',
          data: '',
        },
        'BEGIN:VCARD\nVERSION:4.0\nFN:John Doe\nEND:VCARD',
      );

      // Should update mapping with new etag and synced status
      expect(mocks.cardDavMappingUpdate).toHaveBeenCalledWith({
        where: { id: MAPPING_ID },
        data: expect.objectContaining({
          etag: 'updated-etag',
          syncStatus: 'synced',
          localVersion: 'hash-abc123',
        }),
      });
    });

    it('should throw when person is not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      await expect(autoUpdatePerson(PERSON_ID)).rejects.toThrow('Person not found');
    });

    it('should return early when cardDavSyncEnabled is false', async () => {
      mocks.personFindUnique.mockResolvedValue(makePerson({ cardDavSyncEnabled: false }));

      await autoUpdatePerson(PERSON_ID);

      expect(mocks.cardDavConnectionFindUnique).not.toHaveBeenCalled();
      expect(mocks.updateVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingUpdate).not.toHaveBeenCalled();
    });

    it('should return early when no connection exists', async () => {
      mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

      await autoUpdatePerson(PERSON_ID);

      expect(mocks.updateVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingUpdate).not.toHaveBeenCalled();
    });

    it('should call autoExportPerson when no mapping and autoExportNew is enabled', async () => {
      // No mapping exists
      mocks.cardDavMappingFindUnique.mockResolvedValue(null);
      // Connection has autoExportNew enabled
      mocks.cardDavConnectionFindUnique.mockResolvedValue(
        makeConnection({ autoExportNew: true })
      );

      await autoUpdatePerson(PERSON_ID);

      // Should call createVCard (via autoExportPerson)
      expect(mocks.createVCard).toHaveBeenCalledTimes(1);
      expect(mocks.cardDavMappingCreate).toHaveBeenCalledTimes(1);
    });

    it('should return early when no mapping and autoExportNew is disabled', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue(null);
      mocks.cardDavConnectionFindUnique.mockResolvedValue(
        makeConnection({ autoExportNew: false })
      );

      await autoUpdatePerson(PERSON_ID);

      expect(mocks.createVCard).not.toHaveBeenCalled();
      expect(mocks.updateVCard).not.toHaveBeenCalled();
      expect(mocks.cardDavMappingCreate).not.toHaveBeenCalled();
    });

    it('should mark mapping as pending but not push when sync is disabled', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue(makeMapping());
      mocks.cardDavConnectionFindUnique.mockResolvedValue(
        makeConnection({ syncEnabled: false })
      );

      await autoUpdatePerson(PERSON_ID);

      // Should mark as locally changed with pending status
      expect(mocks.cardDavMappingUpdate).toHaveBeenCalledWith({
        where: { id: MAPPING_ID },
        data: {
          lastLocalChange: expect.any(Date),
          syncStatus: 'pending',
        },
      });

      // Should NOT push to server
      expect(mocks.updateVCard).not.toHaveBeenCalled();

      // Should NOT update mapping with synced status (only the pending update)
      expect(mocks.cardDavMappingUpdate).toHaveBeenCalledTimes(1);
    });

    it('should load photo for update when person has file-based photo', async () => {
      mocks.personFindUnique.mockResolvedValue(makePerson({ photo: 'photo-xyz.png' }));
      mocks.cardDavMappingFindUnique.mockResolvedValue(makeMapping());
      mocks.isPhotoFilename.mockReturnValue(true);
      mocks.readPhotoForExport.mockResolvedValue('data:image/png;base64,iVBOR...');

      await autoUpdatePerson(PERSON_ID);

      expect(mocks.readPhotoForExport).toHaveBeenCalledWith(USER_ID, 'photo-xyz.png');
      expect(mocks.personToVCard).toHaveBeenCalledWith(
        expect.anything(),
        { photoDataUri: 'data:image/png;base64,iVBOR...' },
      );
    });

    it('should log error, update connection lastError, and rethrow on network error', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue(makeMapping());
      const networkError = new Error('Connection refused');
      mocks.updateVCard.mockRejectedValue(networkError);

      await expect(autoUpdatePerson(PERSON_ID)).rejects.toThrow('Connection refused');

      // Should update connection with error info
      expect(mocks.cardDavConnectionUpdate).toHaveBeenCalledWith({
        where: { id: CONNECTION_ID },
        data: {
          lastError: 'Connection refused',
          lastErrorAt: expect.any(Date),
        },
      });
    });

    it('should use empty string for etag when mapping etag is null', async () => {
      mocks.cardDavMappingFindUnique.mockResolvedValue(makeMapping({ etag: null }));

      await autoUpdatePerson(PERSON_ID);

      expect(mocks.updateVCard).toHaveBeenCalledWith(
        expect.objectContaining({
          etag: '',
        }),
        expect.any(String),
      );
    });
  });
});
