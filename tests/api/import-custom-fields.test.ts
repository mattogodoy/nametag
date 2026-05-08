import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionTier } from '@prisma/client';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // customFieldTemplate
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateCreate: vi.fn(),
  templateCount: vi.fn(),
  // personCustomFieldValue
  cfvUpsert: vi.fn(),
  // person
  personFindFirst: vi.fn(),
  personCreate: vi.fn(),
  // group
  groupFindFirst: vi.fn(),
  groupCreate: vi.fn(),
  // personGroup
  personGroupFindUnique: vi.fn(),
  personGroupCreate: vi.fn(),
  // relationshipType
  relTypeFindFirst: vi.fn(),
  // journalEntry
  journalEntryFindFirst: vi.fn(),
  // subscription
  subscriptionFindUnique: vi.fn(),
  // billing counts
  personCount: vi.fn(),
  groupCount: vi.fn(),
  importantDateCount: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    customFieldTemplate: {
      findFirst: mocks.templateFindFirst,
      findMany: mocks.templateFindMany,
      create: mocks.templateCreate,
      count: mocks.templateCount,
    },
    personCustomFieldValue: {
      upsert: mocks.cfvUpsert,
    },
    person: {
      findFirst: mocks.personFindFirst,
      create: mocks.personCreate,
      count: mocks.personCount,
    },
    group: {
      findFirst: mocks.groupFindFirst,
      create: mocks.groupCreate,
      count: mocks.groupCount,
    },
    personGroup: {
      findUnique: mocks.personGroupFindUnique,
      create: mocks.personGroupCreate,
    },
    relationshipType: {
      findFirst: mocks.relTypeFindFirst,
    },
    journalEntry: {
      findFirst: mocks.journalEntryFindFirst,
    },
    importantDate: {
      count: mocks.importantDateCount,
    },
    subscription: {
      findUnique: mocks.subscriptionFindUnique,
    },
  },
}));

// Mock auth
vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

// Mock features — SaaS mode on so tier limits are checked
vi.mock('../../lib/features', () => ({
  isSaasMode: vi.fn(() => true),
}));

// Import after mocks are set up
import { POST as importRoute } from '../../app/api/user/import/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/user/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_PAYLOAD = {
  version: '1.1',
  exportDate: '2026-01-01T00:00:00.000Z',
  groups: [],
  relationships: [],
  relationshipTypes: [],
  journalEntries: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Import — custom field round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // No existing people/groups/templates by default
    mocks.personFindFirst.mockResolvedValue(null);
    mocks.personCreate.mockResolvedValue({ id: 'new-person-1' });
    mocks.groupFindFirst.mockResolvedValue(null);
    mocks.groupCreate.mockResolvedValue({ id: 'new-group-1' });
    mocks.personGroupFindUnique.mockResolvedValue(null);
    mocks.personGroupCreate.mockResolvedValue({});
    mocks.relTypeFindFirst.mockResolvedValue(null);
    mocks.journalEntryFindFirst.mockResolvedValue(null);
    mocks.cfvUpsert.mockResolvedValue({});
    mocks.templateCreate.mockResolvedValue({ id: 'new-tpl-1' });
    mocks.importantDateCount.mockResolvedValue(0);
    mocks.templateCount.mockResolvedValue(0);

    // PRO subscription — unlimited, so tier limits don't interfere with round-trip tests
    mocks.subscriptionFindUnique.mockResolvedValue({
      userId: 'user-123',
      tier: SubscriptionTier.PRO,
      status: 'ACTIVE',
      promotion: null,
    });

    // Billing counts for getUserUsage
    mocks.personCount.mockResolvedValue(0);
    mocks.groupCount.mockResolvedValue(0);
    mocks.importantDateCount.mockResolvedValue(0);
    mocks.templateCount.mockResolvedValue(0);

    // Template slug lookup for tier-limit check (findMany) — no existing slugs
    mocks.templateFindMany.mockResolvedValue([]);

    // Template findFirst for step 1b — nothing pre-existing by default
    mocks.templateFindFirst.mockResolvedValue(null);
  });

  it('reuses an existing template by slug and does NOT call create for it', async () => {
    // 'diet' template already exists in the database
    mocks.templateFindFirst.mockImplementation(async ({ where }) => {
      if (where.slug === 'diet') {
        return { id: 'existing-diet-id', type: 'SELECT', options: ['vegan', 'omnivore'] };
      }
      return null;
    });

    const payload = {
      ...BASE_PAYLOAD,
      people: [],
      customFieldTemplates: [
        { name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan', 'omnivore'], order: 0 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // create should NOT have been called (diet was reused)
    expect(mocks.templateCreate).not.toHaveBeenCalled();
  });

  it('creates a new template only for a slug not already in the database', async () => {
    // 'diet' exists; 'pet-count' does not
    mocks.templateFindFirst.mockImplementation(async ({ where }) => {
      if (where.slug === 'diet') {
        return { id: 'existing-diet-id', type: 'SELECT', options: ['vegan', 'omnivore'] };
      }
      return null;
    });

    const payload = {
      ...BASE_PAYLOAD,
      people: [],
      customFieldTemplates: [
        { name: 'Pet count', slug: 'pet-count', type: 'NUMBER', options: [], order: 1 },
        { name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan', 'omnivore'], order: 0 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // create called exactly once, for pet-count
    expect(mocks.templateCreate).toHaveBeenCalledTimes(1);
    expect(mocks.templateCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'pet-count' }) })
    );
  });

  it('upserts a valid value and skips an invalid one for the same slug', async () => {
    // 'diet' with SELECT options ['vegan', 'omnivore'] exists in db
    mocks.templateFindFirst.mockImplementation(async ({ where }) => {
      if (where.slug === 'diet') {
        return { id: 'existing-diet-id', type: 'SELECT', options: ['vegan', 'omnivore'] };
      }
      return null;
    });

    const payload = {
      ...BASE_PAYLOAD,
      people: [
        {
          id: 'person-import-1',
          name: 'Alice',
          groups: [],
          relationships: [],
          customFieldValues: [
            { slug: 'diet', value: 'vegan' },          // valid option
            { slug: 'diet', value: 'pescatarian' },    // not in options — invalid
          ],
        },
      ],
      customFieldTemplates: [
        { name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan', 'omnivore'], order: 0 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // upsert called exactly once (only for the valid 'vegan' value)
    expect(mocks.cfvUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.cfvUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: 'vegan' }),
      })
    );
  });

  it('skips a value whose slug has no matching template (unknown slug)', async () => {
    // No templates pre-exist; no templates in payload matching 'unknown-slug'
    mocks.templateFindFirst.mockResolvedValue(null);

    const payload = {
      ...BASE_PAYLOAD,
      people: [
        {
          id: 'person-import-1',
          name: 'Alice',
          groups: [],
          relationships: [],
          customFieldValues: [
            { slug: 'unknown-slug', value: 'foo' }, // no template for this slug
          ],
        },
      ],
      customFieldTemplates: [], // no templates at all
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // upsert must NOT be called — unknown slug skipped silently
    expect(mocks.cfvUpsert).not.toHaveBeenCalled();
  });

  it('full round-trip: one new template, one reused, valid value upserted, invalid skipped, unknown slug skipped', async () => {
    // 'diet' exists in db; 'pet-count' does not
    mocks.templateFindFirst.mockImplementation(async ({ where }) => {
      if (where.slug === 'diet') {
        return { id: 'existing-diet-id', type: 'SELECT', options: ['vegan', 'omnivore'] };
      }
      return null;
    });

    const payload = {
      ...BASE_PAYLOAD,
      people: [
        {
          id: 'person-import-1',
          name: 'Alice',
          groups: [],
          relationships: [],
          customFieldValues: [
            { slug: 'diet', value: 'vegan' },          // valid
            { slug: 'diet', value: 'pescatarian' },    // invalid — not in options
            { slug: 'unknown-slug', value: 'foo' },    // missing template
          ],
        },
      ],
      customFieldTemplates: [
        { name: 'Pet count', slug: 'pet-count', type: 'NUMBER', options: [], order: 1 },
        { name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan', 'omnivore'], order: 0 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);

    // create called once — only for pet-count (diet reused)
    expect(mocks.templateCreate).toHaveBeenCalledTimes(1);
    expect(mocks.templateCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'pet-count' }) })
    );
    expect(mocks.templateCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: 'diet' }) })
    );

    // upsert called once — only for the valid diet → vegan
    expect(mocks.cfvUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.cfvUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: 'vegan' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// FREE tier limit enforcement for customFieldTemplates (I-1)
// ---------------------------------------------------------------------------

describe('Import — FREE tier blocks excess custom field templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.personFindFirst.mockResolvedValue(null);
    mocks.groupFindFirst.mockResolvedValue(null);
    mocks.relTypeFindFirst.mockResolvedValue(null);
    mocks.importantDateCount.mockResolvedValue(0);
    mocks.templateCount.mockResolvedValue(0);
    mocks.personCount.mockResolvedValue(0);
    mocks.groupCount.mockResolvedValue(0);

    // FREE subscription
    mocks.subscriptionFindUnique.mockResolvedValue({
      userId: 'user-123',
      tier: SubscriptionTier.FREE,
      status: 'ACTIVE',
      promotion: null,
    });
  });

  it('blocks import when incoming new templates would exceed the FREE tier limit', async () => {
    // FREE limit for customFieldTemplates is 1; user already has 1 existing one
    mocks.templateCount.mockResolvedValue(1);

    // findMany returns the 1 existing slug so it's excluded from the new-count
    mocks.templateFindMany.mockResolvedValue([{ slug: 'existing-a' }]);

    // Importing 1 brand-new template would push total to 2 — over the FREE limit of 1
    const payload = {
      ...BASE_PAYLOAD,
      people: [],
      customFieldTemplates: [
        { name: 'New Field', slug: 'new-field', type: 'TEXT', options: [], order: 1 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    // Should be blocked (403)
    expect(response.status).toBe(403);

    // No templates should have been created
    expect(mocks.templateCreate).not.toHaveBeenCalled();
  });

  it('allows import when incoming new templates fit within the remaining PERSONAL slots', async () => {
    // PERSONAL limit = 20; user has 18 existing templates → 2 remaining slots
    mocks.subscriptionFindUnique.mockResolvedValue({
      userId: 'user-123',
      tier: SubscriptionTier.PERSONAL,
      status: 'ACTIVE',
      promotion: null,
    });
    mocks.templateCount.mockResolvedValue(18);
    mocks.templateFindMany.mockResolvedValue([{ slug: 'existing-a' }]);

    // templateFindFirst for step 1b
    mocks.templateFindFirst.mockResolvedValue(null);
    mocks.templateCreate.mockResolvedValue({ id: 'new-tpl-id' });

    // Importing 1 new template: 18 + 1 = 19 ≤ 20 limit → allowed
    const payload = {
      ...BASE_PAYLOAD,
      people: [],
      customFieldTemplates: [
        { name: 'New Field', slug: 'new-field', type: 'TEXT', options: [], order: 1 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    expect(response.status).toBe(200);
    expect(mocks.templateCreate).toHaveBeenCalledTimes(1);
  });

  it('does not count existing (slug-matched) templates against the new-template quota', async () => {
    // FREE limit = 3; user already has 2 existing templates
    mocks.templateCount.mockResolvedValue(2);

    // Both slugs in the import already exist → 0 new templates
    mocks.templateFindMany.mockResolvedValue([
      { slug: 'diet' },
      { slug: 'pet-count' },
    ]);

    // Step 1b findFirst returns the existing records
    mocks.templateFindFirst.mockImplementation(async ({ where }) => {
      if (where.slug === 'diet') return { id: 'diet-id', type: 'SELECT', options: ['vegan'] };
      if (where.slug === 'pet-count') return { id: 'pet-id', type: 'NUMBER', options: [] };
      return null;
    });

    const payload = {
      ...BASE_PAYLOAD,
      people: [],
      customFieldTemplates: [
        { name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan'], order: 0 },
        { name: 'Pet count', slug: 'pet-count', type: 'NUMBER', options: [], order: 1 },
      ],
    };

    const response = await importRoute(makeRequest(payload));
    // Should succeed — no new templates being added
    expect(response.status).toBe(200);
    expect(mocks.templateCreate).not.toHaveBeenCalled();
  });
});
