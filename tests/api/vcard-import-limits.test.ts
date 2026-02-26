import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for tier limit enforcement in VCF file import (/api/vcard/import)
 */

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // Prisma mocks
  personFindMany: vi.fn(),
  personFindFirst: vi.fn(),
  personCount: vi.fn(),
  groupCount: vi.fn(),
  importantDateCount: vi.fn(),
  subscriptionFindUnique: vi.fn(),
  // Billing mocks
  canCreateResource: vi.fn(),
  getUserUsage: vi.fn(),
  // Features mock
  isSaasMode: vi.fn(),
  // Other mocks
  createPersonFromVCardData: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
      findFirst: mocks.personFindFirst,
      count: mocks.personCount,
    },
    group: {
      count: mocks.groupCount,
    },
    importantDate: {
      count: mocks.importantDateCount,
    },
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
  },
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

// Mock createPersonFromVCardData
vi.mock('@/lib/carddav/person-from-vcard', () => ({
  createPersonFromVCardData: mocks.createPersonFromVCardData,
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
import { POST } from '@/app/api/vcard/import/route';

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

function makeVCardNoUID(name: string): string {
  return [
    'BEGIN:VCARD',
    'VERSION:4.0',
    `FN:${name}`,
    `N:;${name};;;`,
    'END:VCARD',
  ].join('\r\n');
}

function createRequest(body: string): Request {
  return new Request('http://localhost/api/vcard/import', {
    method: 'POST',
    body,
  });
}

describe('VCF Import Tier Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: SaaS mode enabled
    mocks.isSaasMode.mockReturnValue(true);

    // Default: person not found (all contacts are new)
    mocks.personFindMany.mockResolvedValue([]);
    mocks.personFindFirst.mockResolvedValue(null);

    // Default: createPersonFromVCardData succeeds
    mocks.createPersonFromVCardData.mockResolvedValue({ id: 'new-person-1', uid: 'uid-1' });
  });

  it('should return 403 when VCF import would exceed tier limit', async () => {
    // User has 48 contacts, limit is 50, trying to import 5
    mocks.getUserUsage.mockResolvedValue({ people: 48, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 48,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    const vcards = [
      makeVCard('uid-1', 'Alice'),
      makeVCard('uid-2', 'Bob'),
      makeVCard('uid-3', 'Charlie'),
      makeVCard('uid-4', 'Diana'),
      makeVCard('uid-5', 'Eve'),
    ].join('\n');

    const response = await POST(createRequest(vcards));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.code).toBe('LIMIT_EXCEEDED');
    expect(data.error).toContain('exceed');
    expect(data.available).toBe(2);
    expect(data.requested).toBe(5);
  });

  it('should allow VCF import when within limits', async () => {
    // User has 45 contacts, limit is 50, trying to import 3
    mocks.getUserUsage.mockResolvedValue({ people: 45, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 45,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    const vcards = [
      makeVCard('uid-1', 'Alice'),
      makeVCard('uid-2', 'Bob'),
      makeVCard('uid-3', 'Charlie'),
    ].join('\n');

    const response = await POST(createRequest(vcards));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should not count duplicate UIDs toward new contact count', async () => {
    // User has 48 contacts, limit is 50, importing 5 but 3 already exist
    mocks.getUserUsage.mockResolvedValue({ people: 48, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 48,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    // 3 of the 5 UIDs already exist
    mocks.personFindMany.mockResolvedValue([
      { uid: 'uid-1' },
      { uid: 'uid-2' },
      { uid: 'uid-3' },
    ]);
    // personFindFirst is used in the import loop for per-contact duplicate check
    mocks.personFindFirst.mockImplementation(async ({ where }: { where: { uid: string } }) => {
      if (['uid-1', 'uid-2', 'uid-3'].includes(where.uid)) {
        return { id: 'existing', uid: where.uid };
      }
      return null;
    });

    const vcards = [
      makeVCard('uid-1', 'Alice'),
      makeVCard('uid-2', 'Bob'),
      makeVCard('uid-3', 'Charlie'),
      makeVCard('uid-4', 'Diana'),
      makeVCard('uid-5', 'Eve'),
    ].join('\n');

    const response = await POST(createRequest(vcards));
    const data = await response.json();

    // Only 2 are new (uid-4, uid-5), 48 + 2 = 50 <= 50, so should pass
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should allow unlimited imports in non-SaaS mode', async () => {
    // Non-SaaS mode: no limit check
    mocks.isSaasMode.mockReturnValue(false);

    const vcards = Array.from({ length: 100 }, (_, i) =>
      makeVCard(`uid-${i}`, `Person ${i}`)
    ).join('\n');

    const response = await POST(createRequest(vcards));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // canCreateResource should not be called in non-SaaS mode
    expect(mocks.canCreateResource).not.toHaveBeenCalled();
    expect(mocks.getUserUsage).not.toHaveBeenCalled();
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

    const vcards = [
      makeVCard('uid-1', 'Alice'),
      makeVCard('uid-2', 'Bob'),
    ].join('\n');

    const response = await POST(createRequest(vcards));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should count vCards without UIDs as new contacts', async () => {
    // User has 49 contacts, limit is 50, importing 2 without UIDs
    mocks.getUserUsage.mockResolvedValue({ people: 49, groups: 2, reminders: 0 });
    mocks.canCreateResource.mockResolvedValue({
      allowed: true,
      current: 49,
      limit: 50,
      tier: 'FREE',
      isUnlimited: false,
    });

    const vcards = [
      makeVCardNoUID('Alice'),
      makeVCardNoUID('Bob'),
    ].join('\n');

    const response = await POST(createRequest(vcards));
    const data = await response.json();

    // 49 + 2 = 51 > 50, should be rejected
    expect(response.status).toBe(403);
    expect(data.code).toBe('LIMIT_EXCEEDED');
    expect(data.available).toBe(1);
    expect(data.requested).toBe(2);
  });
});
