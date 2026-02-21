/**
 * Tests for /api/carddav/import endpoint — duplicate UID handling.
 *
 * Verifies that the import loop correctly handles:
 * - Two pending imports with the same UID (map update prevents double-create)
 * - File imports where a person with the UID already exists (skipped)
 * - Mixed file-import + existing-person scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/carddav/import/route';
import { auth } from '@/lib/auth';

// ── hoisted mocks ───────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  findUniqueConnection: vi.fn(),
  findManyPending: vi.fn(),
  findManyMapping: vi.fn(),
  findManyPerson: vi.fn(),
  deletePending: vi.fn(),
  createMapping: vi.fn(),
  findManyGroup: vi.fn(),
  findManyPersonGroup: vi.fn(),
  createManyPersonGroup: vi.fn(),
  createPersonFromVCardData: vi.fn(),
  restorePersonFromVCardData: vi.fn(),
  rawFindMany: vi.fn(),
  rawDisconnect: vi.fn(),
}));

vi.mock('@/lib/auth');

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: { findUnique: mocks.findUniqueConnection },
    cardDavPendingImport: {
      findMany: mocks.findManyPending,
      delete: mocks.deletePending,
    },
    cardDavMapping: {
      findMany: mocks.findManyMapping,
      create: mocks.createMapping,
    },
    person: { findMany: mocks.findManyPerson },
    group: { findMany: mocks.findManyGroup },
    personGroup: {
      findMany: mocks.findManyPersonGroup,
      createMany: mocks.createManyPersonGroup,
    },
  },
  withDeleted: () => ({
    person: { findMany: mocks.rawFindMany },
    $disconnect: mocks.rawDisconnect,
  }),
}));

vi.mock('@/lib/carddav/person-from-vcard', () => ({
  createPersonFromVCardData: mocks.createPersonFromVCardData,
  restorePersonFromVCardData: mocks.restorePersonFromVCardData,
}));

// ── helpers ─────────────────────────────────────────────────────────────────
function makeVCard(uid: string, name: string) {
  return `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${name}\r\nN:;${name};;;\r\nUID:${uid}\r\nEND:VCARD`;
}

function makePendingImport(
  id: string,
  uid: string,
  name: string,
  opts: { uploadedByUserId?: string | null } = {},
) {
  return {
    id,
    connectionId: null,
    uploadedByUserId: opts.uploadedByUserId ?? 'user-1',
    uid,
    href: `file-import-${id}`,
    etag: 'etag',
    vCardData: makeVCard(uid, name),
    displayName: name,
    discoveredAt: new Date(),
    notifiedAt: null,
  };
}

function postImport(importIds: string[]) {
  return POST(
    new Request('http://localhost/api/carddav/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ importIds }),
    }),
  );
}

// ── tests ───────────────────────────────────────────────────────────────────
describe('POST /api/carddav/import — duplicate UID handling', () => {
  const session = { user: { id: 'user-1', email: 'u@example.com' } };

  beforeEach(() => {
    vi.clearAllMocks();
    (auth as ReturnType<typeof vi.fn>).mockResolvedValue(session);

    // Default: no CardDAV connection (file-import-only user)
    mocks.findUniqueConnection.mockResolvedValue(null);
    // Default: no existing mappings / persons / soft-deleted
    mocks.findManyMapping.mockResolvedValue([]);
    mocks.findManyPerson.mockResolvedValue([]);
    mocks.rawFindMany.mockResolvedValue([]);
    mocks.rawDisconnect.mockResolvedValue(undefined);
    // Default: no groups
    mocks.findManyGroup.mockResolvedValue([]);
    mocks.findManyPersonGroup.mockResolvedValue([]);
    // Default: delete succeeds
    mocks.deletePending.mockResolvedValue({});
  });

  it('should import only one person when two pending imports share the same UID', async () => {
    const pending = [
      makePendingImport('p-1', 'shared-uid', 'Alice V1'),
      makePendingImport('p-2', 'shared-uid', 'Alice V2'),
    ];
    mocks.findManyPending.mockResolvedValue(pending);

    // First create succeeds; second should be skipped via map update
    mocks.createPersonFromVCardData.mockResolvedValueOnce({
      id: 'person-1',
      uid: 'shared-uid',
    });

    const res = await postImport(['p-1', 'p-2']);
    const data = await res.json();

    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(1);
    expect(mocks.createPersonFromVCardData).toHaveBeenCalledTimes(1);
  });

  it('should skip file imports when a person with the same UID already exists', async () => {
    const pending = [
      makePendingImport('p-1', 'existing-uid', 'Bob'),
    ];
    mocks.findManyPending.mockResolvedValue(pending);

    // Pre-existing person with the same UID
    mocks.findManyPerson.mockResolvedValue([
      { id: 'existing-person', uid: 'existing-uid' },
    ]);

    const res = await postImport(['p-1']);
    const data = await res.json();

    expect(data.skipped).toBe(1);
    expect(data.imported).toBe(0);
    // Should NOT create a CardDAV mapping for file imports
    expect(mocks.createMapping).not.toHaveBeenCalled();
    // Pending import should be cleaned up
    expect(mocks.deletePending).toHaveBeenCalledWith({
      where: { id: 'p-1' },
    });
  });

  it('should handle mix: one new UID, one existing UID, one duplicate of the new', async () => {
    const pending = [
      makePendingImport('p-1', 'new-uid', 'Charlie'),
      makePendingImport('p-2', 'existing-uid', 'Dana'),
      makePendingImport('p-3', 'new-uid', 'Charlie Updated'),
    ];
    mocks.findManyPending.mockResolvedValue(pending);

    // existing-uid already in the database
    mocks.findManyPerson.mockResolvedValue([
      { id: 'existing-person', uid: 'existing-uid' },
    ]);

    mocks.createPersonFromVCardData.mockResolvedValueOnce({
      id: 'person-charlie',
      uid: 'new-uid',
    });

    const res = await postImport(['p-1', 'p-2', 'p-3']);
    const data = await res.json();

    // p-1 → imported (new-uid, first occurrence)
    // p-2 → skipped (existing-uid already exists)
    // p-3 → skipped (new-uid now in map after p-1 was imported)
    expect(data.imported).toBe(1);
    expect(data.skipped).toBe(2);
    expect(mocks.createPersonFromVCardData).toHaveBeenCalledTimes(1);
  });

  it('should create CardDAV mapping for CardDAV imports but not file imports', async () => {
    const cardDavPending = {
      id: 'p-carddav',
      connectionId: 'conn-1',
      uploadedByUserId: null, // CardDAV import
      uid: 'carddav-uid',
      href: '/addressbooks/card.vcf',
      etag: '"etag-1"',
      vCardData: makeVCard('carddav-uid', 'Eve'),
      displayName: 'Eve',
      discoveredAt: new Date(),
      notifiedAt: null,
    };
    const filePending = makePendingImport('p-file', 'file-uid', 'Frank');

    mocks.findManyPending.mockResolvedValue([cardDavPending, filePending]);

    // User has a CardDAV connection
    mocks.findUniqueConnection.mockResolvedValue({ id: 'conn-1' });

    mocks.createPersonFromVCardData
      .mockResolvedValueOnce({ id: 'person-eve', uid: 'carddav-uid' })
      .mockResolvedValueOnce({ id: 'person-frank', uid: 'file-uid' });

    const res = await postImport(['p-carddav', 'p-file']);
    const data = await res.json();

    expect(data.imported).toBe(2);

    // Only the CardDAV import should create a mapping
    expect(mocks.createMapping).toHaveBeenCalledTimes(1);
    expect(mocks.createMapping).toHaveBeenCalledWith({
      data: expect.objectContaining({
        connectionId: 'conn-1',
        personId: 'person-eve',
        uid: 'carddav-uid',
      }),
    });
  });

  it('should restore soft-deleted person instead of creating a new one', async () => {
    const pending = [
      makePendingImport('p-1', 'deleted-uid', 'Restored Guy'),
    ];
    mocks.findManyPending.mockResolvedValue(pending);

    // No active person, but a soft-deleted one exists
    mocks.findManyPerson.mockResolvedValue([]);
    mocks.rawFindMany.mockResolvedValue([
      { id: 'soft-deleted-person', uid: 'deleted-uid', deletedAt: new Date() },
    ]);

    mocks.restorePersonFromVCardData.mockResolvedValueOnce({
      id: 'soft-deleted-person',
      uid: 'deleted-uid',
    });

    const res = await postImport(['p-1']);
    const data = await res.json();

    expect(data.imported).toBe(1);
    expect(mocks.restorePersonFromVCardData).toHaveBeenCalledTimes(1);
    expect(mocks.createPersonFromVCardData).not.toHaveBeenCalled();
  });

  it('should return 404 when no pending imports match', async () => {
    mocks.findManyPending.mockResolvedValue([]);

    const res = await postImport(['nonexistent']);
    expect(res.status).toBe(404);
  });
});
