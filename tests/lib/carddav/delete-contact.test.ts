/**
 * Unit tests for CardDAV delete-contact module (lib/carddav/delete-contact.ts)
 *
 * Covers:
 * - deleteFromCardDav: deleting a person's vCard from CardDAV server
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Hoisted mocks ---

const mocks = vi.hoisted(() => ({
  // Prisma
  personFindUnique: vi.fn(),

  // CardDAV client
  deleteVCard: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
    },
  },
}));

vi.mock('@/lib/carddav/client', () => ({
  createCardDavClient: vi.fn(() =>
    Promise.resolve({
      deleteVCard: mocks.deleteVCard,
    })
  ),
}));

vi.mock('@/lib/carddav/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
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

// --- Import after mocks ---
import { deleteFromCardDav } from '@/lib/carddav/delete-contact';

// --- Test data helpers ---

const PERSON_ID = 'person-1';
const CONNECTION_ID = 'conn-1';

function makePersonWithMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: PERSON_ID,
    userId: 'user-1',
    name: 'John',
    surname: 'Doe',
    cardDavMapping: {
      id: 'mapping-1',
      connectionId: CONNECTION_ID,
      personId: PERSON_ID,
      uid: 'uid-123',
      href: 'https://carddav.example.com/contacts/uid-123.vcf',
      etag: 'etag-1',
      syncStatus: 'synced',
      connection: {
        id: CONNECTION_ID,
        userId: 'user-1',
        serverUrl: 'https://carddav.example.com',
        username: 'test',
        password: 'encrypted-password',
        syncEnabled: true,
      },
      ...overrides,
    },
  };
}

// --- Tests ---

describe('CardDAV Delete Contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.personFindUnique.mockResolvedValue(makePersonWithMapping());
    mocks.deleteVCard.mockResolvedValue(undefined);
  });

  describe('deleteFromCardDav', () => {
    it('should delete vCard from server and return true on success', async () => {
      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(true);

      // Should look up person with mapping and connection
      expect(mocks.personFindUnique).toHaveBeenCalledWith({
        where: { id: PERSON_ID },
        include: {
          cardDavMapping: {
            include: {
              connection: true,
            },
          },
        },
      });

      // Should delete the vCard from the server
      expect(mocks.deleteVCard).toHaveBeenCalledWith({
        url: 'https://carddav.example.com/contacts/uid-123.vcf',
        etag: 'etag-1',
        data: '',
      });
    });

    it('should return false when person is not found', async () => {
      mocks.personFindUnique.mockResolvedValue(null);

      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(false);
      expect(mocks.deleteVCard).not.toHaveBeenCalled();
    });

    it('should return false when person has no CardDAV mapping', async () => {
      mocks.personFindUnique.mockResolvedValue({
        id: PERSON_ID,
        userId: 'user-1',
        name: 'John',
        cardDavMapping: null,
      });

      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(false);
      expect(mocks.deleteVCard).not.toHaveBeenCalled();
    });

    it('should use empty string for etag when mapping etag is null', async () => {
      mocks.personFindUnique.mockResolvedValue(makePersonWithMapping({ etag: null }));

      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(true);
      expect(mocks.deleteVCard).toHaveBeenCalledWith(
        expect.objectContaining({
          etag: '',
        }),
      );
    });

    it('should return false and not throw on network error', async () => {
      mocks.deleteVCard.mockRejectedValue(new Error('Network timeout'));

      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(false);
    });

    it('should return false and not throw on server error', async () => {
      mocks.deleteVCard.mockRejectedValue(new Error('500 Internal Server Error'));

      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(false);
    });

    it('should return false and not throw on non-Error exceptions', async () => {
      mocks.deleteVCard.mockRejectedValue('string error');

      const result = await deleteFromCardDav(PERSON_ID);

      expect(result).toBe(false);
    });
  });
});
