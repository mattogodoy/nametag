import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for tier limit enforcement in CardDAV/VCF pending import (/api/carddav/import)
 */

// Helper to build a minimal vCard string
function makeVCard(uid: string, name: string): string {
  return [
    'BEGIN:VCARD',
    'VERSION:4.0',
    `UID:${uid}`,
    `FN:${name}`,
    `N:;${name};;;`,
    'END:VCARD',
  ].join('\r\n');
}

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // Prisma mocks
  cardDavConnectionFindUnique: vi.fn(),
  cardDavPendingImportFindMany: vi.fn(),
  cardDavPendingImportDelete: vi.fn(),
  cardDavMappingFindMany: vi.fn(),
  cardDavMappingCreate: vi.fn(),
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  personGroupFindMany: vi.fn(),
  personGroupCreateMany: vi.fn(),
  groupFindMany: vi.fn(),
  relationshipTypeFindMany: vi.fn(),
  // withDeleted mock
  withDeletedPersonFindMany: vi.fn(),
  withDeletedDisconnect: vi.fn(),
  // Billing mocks
  canCreateResource: vi.fn(),
  getUserUsage: vi.fn(),
  // Features mock
  isSaasMode: vi.fn(),
  // Other mocks
  createPersonFromVCardData: vi.fn(),
  restorePersonFromVCardData: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cardDavConnection: {
      findUnique: mocks.cardDavConnectionFindUnique,
    },
    cardDavPendingImport: {
      findMany: mocks.cardDavPendingImportFindMany,
      delete: mocks.cardDavPendingImportDelete,
    },
    cardDavMapping: {
      findMany: mocks.cardDavMappingFindMany,
      create: mocks.cardDavMappingCreate,
    },
    person: {
      findMany: mocks.personFindMany,
      update: mocks.personUpdate,
    },
    personGroup: {
      findMany: mocks.personGroupFindMany,
      createMany: mocks.personGroupCreateMany,
    },
    group: {
      findMany: mocks.groupFindMany,
    },
    relationshipType: {
      findMany: mocks.relationshipTypeFindMany,
    },
  },
  withDeleted: () => ({
    person: {
      findMany: mocks.withDeletedPersonFindMany,
    },
    $disconnect: mocks.withDeletedDisconnect,
  }),
}));

// Mock billing module
vi.mock('@/lib/billing', () => ({
  canCreateResource: mocks.canCreateResource,
  getUserUsage: mocks.getUserUsage,
}));

// Mock features
vi.mock('@/lib/features', () => ({
  isSaasMode: mocks.isSaasMode,
}));

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Mock sanitize (pass-through)
vi.mock('@/lib/sanitize', () => ({
  sanitizeName: (s: string) => s,
  sanitizeNotes: (s: string) => s,
}));

// Mock createPersonFromVCardData and restorePersonFromVCardData
vi.mock('@/lib/carddav/person-from-vcard', () => ({
  createPersonFromVCardData: mocks.createPersonFromVCardData,
  restorePersonFromVCardData: mocks.restorePersonFromVCardData,
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock api-utils (withLogging is a pass-through wrapper)
vi.mock('@/lib/api-utils', () => ({
  withLogging: (fn: Function) => fn,
}));

// Import after mocking
import { POST } from '@/app/api/carddav/import/route';

function createRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/carddav/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('CardDAV Import Tier Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: SaaS mode enabled
    mocks.isSaasMode.mockReturnValue(true);

    // Default: no CardDAV connection (file import mode)
    mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

    // Default: no existing mappings
    mocks.cardDavMappingFindMany.mockResolvedValue([]);

    // Default: no existing active persons with matching UIDs
    mocks.personFindMany.mockResolvedValue([]);

    // Default: no soft-deleted persons
    mocks.withDeletedPersonFindMany.mockResolvedValue([]);
    mocks.withDeletedDisconnect.mockResolvedValue(undefined);

    // Default: no relationship types
    mocks.relationshipTypeFindMany.mockResolvedValue([]);

    // Default: pending import delete succeeds
    mocks.cardDavPendingImportDelete.mockResolvedValue(undefined);

    // Default: createPersonFromVCardData succeeds
    mocks.createPersonFromVCardData.mockResolvedValue({ id: 'new-person-1', uid: 'uid-1' });
  });

  it('should return 403 when import would exceed tier limit', async () => {
    // User has 48 contacts, limit is 50, trying to import 5 new contacts
    mocks.getUserUsage.mockResolvedValue({ people: 48, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 48,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    const pendingImports = Array.from({ length: 5 }, (_, i) => ({
      id: `pending-${i}`,
      uid: `uid-${i}`,
      href: `/contact-${i}.vcf`,
      etag: `"etag-${i}"`,
      vCardData: makeVCard(`uid-${i}`, `Person ${i}`),
      displayName: `Person ${i}`,
      uploadedByUserId: 'user-123',
      connectionId: null,
    }));

    mocks.cardDavPendingImportFindMany.mockResolvedValue(pendingImports);

    const response = await POST(
      createRequest({
        importIds: pendingImports.map((p) => p.id),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('LIMIT_EXCEEDED');
    expect(data.error).toContain('exceed');
    expect(data.available).toBe(2);
    expect(data.requested).toBe(5);
  });

  it('should not count existing/duplicate contacts toward new count', async () => {
    // User has 48 contacts, limit is 50, importing 5 but 3 already exist as active persons
    mocks.getUserUsage.mockResolvedValue({ people: 48, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 48,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    const pendingImports = Array.from({ length: 5 }, (_, i) => ({
      id: `pending-${i}`,
      uid: `uid-${i}`,
      href: `/contact-${i}.vcf`,
      etag: `"etag-${i}"`,
      vCardData: makeVCard(`uid-${i}`, `Person ${i}`),
      displayName: `Person ${i}`,
      uploadedByUserId: 'user-123',
      connectionId: null,
    }));

    mocks.cardDavPendingImportFindMany.mockResolvedValue(pendingImports);

    // 3 of the 5 already exist as active persons
    mocks.personFindMany.mockResolvedValue([
      { id: 'existing-0', uid: 'uid-0' },
      { id: 'existing-1', uid: 'uid-1' },
      { id: 'existing-2', uid: 'uid-2' },
    ]);

    const response = await POST(
      createRequest({
        importIds: pendingImports.map((p) => p.id),
      })
    );
    const data = await response.json();

    // Only 2 are new (uid-3, uid-4), 48 + 2 = 50 <= 50, should pass
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should allow unlimited imports in non-SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(false);

    const pendingImports = Array.from({ length: 100 }, (_, i) => ({
      id: `pending-${i}`,
      uid: `uid-${i}`,
      href: `/contact-${i}.vcf`,
      etag: `"etag-${i}"`,
      vCardData: makeVCard(`uid-${i}`, `Person ${i}`),
      displayName: `Person ${i}`,
      uploadedByUserId: 'user-123',
      connectionId: null,
    }));

    mocks.cardDavPendingImportFindMany.mockResolvedValue(pendingImports);

    const response = await POST(
      createRequest({
        importIds: pendingImports.map((p) => p.id),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // canCreateResource should not be called in non-SaaS mode
    expect(mocks.canCreateResource).not.toHaveBeenCalled();
    expect(mocks.getUserUsage).not.toHaveBeenCalled();
  });

  it('should allow import when within limits', async () => {
    // User has 45 contacts, limit is 50, trying to import 3 new contacts
    mocks.getUserUsage.mockResolvedValue({ people: 45, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 45,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    const pendingImports = Array.from({ length: 3 }, (_, i) => ({
      id: `pending-${i}`,
      uid: `uid-${i}`,
      href: `/contact-${i}.vcf`,
      etag: `"etag-${i}"`,
      vCardData: makeVCard(`uid-${i}`, `Person ${i}`),
      displayName: `Person ${i}`,
      uploadedByUserId: 'user-123',
      connectionId: null,
    }));

    mocks.cardDavPendingImportFindMany.mockResolvedValue(pendingImports);

    const response = await POST(
      createRequest({
        importIds: pendingImports.map((p) => p.id),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should not count contacts with existing CardDAV mappings as new', async () => {
    // User has 49 contacts, limit is 50, importing 3 but 2 have existing mappings
    mocks.getUserUsage.mockResolvedValue({ people: 49, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 49,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    // Set up a CardDAV connection
    mocks.cardDavConnectionFindUnique.mockResolvedValue({
      id: 'conn-1',
      userId: 'user-123',
    });

    const pendingImports = Array.from({ length: 3 }, (_, i) => ({
      id: `pending-${i}`,
      uid: `uid-${i}`,
      href: `/contact-${i}.vcf`,
      etag: `"etag-${i}"`,
      vCardData: makeVCard(`uid-${i}`, `Person ${i}`),
      displayName: `Person ${i}`,
      uploadedByUserId: null,
      connectionId: 'conn-1',
    }));

    mocks.cardDavPendingImportFindMany.mockResolvedValue(pendingImports);

    // 2 of the 3 have existing mappings
    mocks.cardDavMappingFindMany.mockResolvedValue([
      { uid: 'uid-0', personId: 'person-0' },
      { uid: 'uid-1', personId: 'person-1' },
    ]);

    const response = await POST(
      createRequest({
        importIds: pendingImports.map((p) => p.id),
      })
    );
    const data = await response.json();

    // Only 1 is new (uid-2), 49 + 1 = 50 <= 50, should pass
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should allow unlimited imports for PRO tier (isUnlimited)', async () => {
    mocks.getUserUsage.mockResolvedValue({ people: 5000, groups: 100, reminders: 50 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 5000,
      limit: Infinity,
      tier: 'PRO',
      isUnlimited: true,
    });

    const pendingImports = Array.from({ length: 10 }, (_, i) => ({
      id: `pending-${i}`,
      uid: `uid-${i}`,
      href: `/contact-${i}.vcf`,
      etag: `"etag-${i}"`,
      vCardData: makeVCard(`uid-${i}`, `Person ${i}`),
      displayName: `Person ${i}`,
      uploadedByUserId: 'user-123',
      connectionId: null,
    }));

    mocks.cardDavPendingImportFindMany.mockResolvedValue(pendingImports);

    const response = await POST(
      createRequest({
        importIds: pendingImports.map((p) => p.id),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
