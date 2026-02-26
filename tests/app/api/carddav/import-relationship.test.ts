/**
 * Tests for /api/carddav/import endpoint — relationship assignment.
 *
 * Verifies that the import correctly handles:
 * - Global relationship type assignment
 * - Per-contact relationship overrides
 * - __none__ sentinel preventing assignment even with global set
 * - Invalid relationship type IDs (wrong user) are ignored
 * - No relationship fields = no person.update for relationship
 * - Works with soft-deleted person restoration
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
  updatePerson: vi.fn(),
  deletePending: vi.fn(),
  createMapping: vi.fn(),
  findManyGroup: vi.fn(),
  findManyPersonGroup: vi.fn(),
  createManyPersonGroup: vi.fn(),
  findManyRelationshipType: vi.fn(),
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
    person: {
      findMany: mocks.findManyPerson,
      update: mocks.updatePerson,
    },
    group: { findMany: mocks.findManyGroup },
    personGroup: {
      findMany: mocks.findManyPersonGroup,
      createMany: mocks.createManyPersonGroup,
    },
    relationshipType: { findMany: mocks.findManyRelationshipType },
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

function makePendingImport(id: string, uid: string, name: string) {
  return {
    id,
    connectionId: null,
    uploadedByUserId: 'user-1',
    uid,
    href: `file-import-${id}`,
    etag: 'etag',
    vCardData: makeVCard(uid, name),
    displayName: name,
    discoveredAt: new Date(),
    notifiedAt: null,
  };
}

function postImport(body: Record<string, unknown>) {
  return POST(
    new Request('http://localhost/api/carddav/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

// ── tests ───────────────────────────────────────────────────────────────────
describe('POST /api/carddav/import — relationship assignment', () => {
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
    // Default: no relationship types
    mocks.findManyRelationshipType.mockResolvedValue([]);
    // Default: delete and update succeed
    mocks.deletePending.mockResolvedValue({});
    mocks.updatePerson.mockResolvedValue({});
  });

  it('should set relationshipToUserId on imported contacts using global value', async () => {
    const pending = [makePendingImport('p-1', 'uid-1', 'Alice')];
    mocks.findManyPending.mockResolvedValue(pending);

    mocks.findManyRelationshipType.mockResolvedValue([{ id: 'rel-friend' }]);
    mocks.createPersonFromVCardData.mockResolvedValueOnce({
      id: 'person-1',
      uid: 'uid-1',
    });

    const res = await postImport({
      importIds: ['p-1'],
      globalRelationshipTypeId: 'rel-friend',
    });
    const data = await res.json();

    expect(data.imported).toBe(1);
    expect(mocks.updatePerson).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { relationshipToUserId: 'rel-friend' },
    });
  });

  it('should allow per-contact relationship to override global', async () => {
    const pending = [
      makePendingImport('p-1', 'uid-1', 'Alice'),
      makePendingImport('p-2', 'uid-2', 'Bob'),
    ];
    mocks.findManyPending.mockResolvedValue(pending);

    mocks.findManyRelationshipType.mockResolvedValue([
      { id: 'rel-friend' },
      { id: 'rel-family' },
    ]);
    mocks.createPersonFromVCardData
      .mockResolvedValueOnce({ id: 'person-1', uid: 'uid-1' })
      .mockResolvedValueOnce({ id: 'person-2', uid: 'uid-2' });

    const res = await postImport({
      importIds: ['p-1', 'p-2'],
      globalRelationshipTypeId: 'rel-friend',
      perContactRelationshipTypeId: { 'p-2': 'rel-family' },
    });
    const data = await res.json();

    expect(data.imported).toBe(2);

    // Alice gets global
    expect(mocks.updatePerson).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      data: { relationshipToUserId: 'rel-friend' },
    });

    // Bob gets per-contact override
    expect(mocks.updatePerson).toHaveBeenCalledWith({
      where: { id: 'person-2' },
      data: { relationshipToUserId: 'rel-family' },
    });
  });

  it('should not set relationship when __none__ sentinel is used, even with global set', async () => {
    const pending = [makePendingImport('p-1', 'uid-1', 'Alice')];
    mocks.findManyPending.mockResolvedValue(pending);

    mocks.findManyRelationshipType.mockResolvedValue([{ id: 'rel-friend' }]);
    mocks.createPersonFromVCardData.mockResolvedValueOnce({
      id: 'person-1',
      uid: 'uid-1',
    });

    const res = await postImport({
      importIds: ['p-1'],
      globalRelationshipTypeId: 'rel-friend',
      perContactRelationshipTypeId: { 'p-1': '__none__' },
    });
    const data = await res.json();

    expect(data.imported).toBe(1);
    // __none__ should prevent the update call
    expect(mocks.updatePerson).not.toHaveBeenCalled();
  });

  it('should ignore invalid relationship type ID (wrong user)', async () => {
    const pending = [makePendingImport('p-1', 'uid-1', 'Alice')];
    mocks.findManyPending.mockResolvedValue(pending);

    // The pre-fetch returns empty — the ID doesn't belong to this user
    mocks.findManyRelationshipType.mockResolvedValue([]);
    mocks.createPersonFromVCardData.mockResolvedValueOnce({
      id: 'person-1',
      uid: 'uid-1',
    });

    const res = await postImport({
      importIds: ['p-1'],
      globalRelationshipTypeId: 'rel-wrong-user',
    });
    const data = await res.json();

    expect(data.imported).toBe(1);
    // Invalid ID should not trigger update
    expect(mocks.updatePerson).not.toHaveBeenCalled();
  });

  it('should not call person.update when no relationship fields are provided', async () => {
    const pending = [makePendingImport('p-1', 'uid-1', 'Alice')];
    mocks.findManyPending.mockResolvedValue(pending);

    mocks.createPersonFromVCardData.mockResolvedValueOnce({
      id: 'person-1',
      uid: 'uid-1',
    });

    const res = await postImport({
      importIds: ['p-1'],
    });
    const data = await res.json();

    expect(data.imported).toBe(1);
    expect(mocks.updatePerson).not.toHaveBeenCalled();
  });

  it('should work with soft-deleted person restoration', async () => {
    const pending = [makePendingImport('p-1', 'deleted-uid', 'Restored')];
    mocks.findManyPending.mockResolvedValue(pending);

    // No active person, but a soft-deleted one exists
    mocks.findManyPerson.mockResolvedValue([]);
    mocks.rawFindMany.mockResolvedValue([
      { id: 'soft-deleted-person', uid: 'deleted-uid', deletedAt: new Date() },
    ]);

    mocks.findManyRelationshipType.mockResolvedValue([{ id: 'rel-friend' }]);
    mocks.restorePersonFromVCardData.mockResolvedValueOnce({
      id: 'soft-deleted-person',
      uid: 'deleted-uid',
    });

    const res = await postImport({
      importIds: ['p-1'],
      globalRelationshipTypeId: 'rel-friend',
    });
    const data = await res.json();

    expect(data.imported).toBe(1);
    expect(mocks.restorePersonFromVCardData).toHaveBeenCalledTimes(1);
    expect(mocks.updatePerson).toHaveBeenCalledWith({
      where: { id: 'soft-deleted-person' },
      data: { relationshipToUserId: 'rel-friend' },
    });
  });
});
