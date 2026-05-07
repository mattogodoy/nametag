import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  // Prisma
  personFindUnique: vi.fn(),
  personCreate: vi.fn(),
  personDelete: vi.fn(),
  personUpdate: vi.fn(),
  importantDateCount: vi.fn(),
  personCustomFieldValueDeleteMany: vi.fn(),
  personCustomFieldValueUpsert: vi.fn(),
  customFieldTemplateFindMany: vi.fn(),
  transaction: vi.fn(),
  // Service
  createPerson: vi.fn(),
  updatePerson: vi.fn(),
  // Persistence
  applyCustomFieldValues: vi.fn(),
  validateCustomFieldValues: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findUnique: mocks.personFindUnique,
      create: mocks.personCreate,
      delete: mocks.personDelete,
      update: mocks.personUpdate,
    },
    importantDate: {
      count: mocks.importantDateCount,
    },
    personCustomFieldValue: {
      deleteMany: mocks.personCustomFieldValueDeleteMany,
      upsert: mocks.personCustomFieldValueUpsert,
    },
    customFieldTemplate: {
      findMany: mocks.customFieldTemplateFindMany,
    },
    $transaction: mocks.transaction,
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

// Mock billing
vi.mock('../../lib/billing', () => ({
  canCreateResource: vi.fn(() =>
    Promise.resolve({ allowed: true, current: 0, limit: 50, tier: 'FREE', isUnlimited: false })
  ),
  canEnableReminder: vi.fn(() =>
    Promise.resolve({ allowed: true, current: 0, limit: 5, isUnlimited: false })
  ),
}));

// Mock the person service
vi.mock('../../lib/services/person', () => ({
  createPerson: mocks.createPerson,
  updatePerson: mocks.updatePerson,
  deletePerson: vi.fn(),
}));

// Mock the persistence module so we can inspect calls in route tests
vi.mock('../../lib/customFields/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/customFields/persistence')>();
  return {
    ...actual,
    applyCustomFieldValues: mocks.applyCustomFieldValues,
    validateCustomFieldValues: mocks.validateCustomFieldValues,
  };
});

// Mock photo storage
vi.mock('../../lib/photo-storage', () => ({
  savePhoto: vi.fn(() => Promise.resolve(null)),
  deletePersonPhotos: vi.fn(() => Promise.resolve()),
  isPhotoFilename: vi.fn(() => false),
}));

// Mock carddav
vi.mock('../../lib/carddav/auto-export', () => ({
  autoExportPerson: vi.fn(() => Promise.resolve()),
  autoUpdatePerson: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../lib/carddav/delete-contact', () => ({
  deleteFromCardDav: vi.fn(() => Promise.resolve(true)),
}));

// Mock prisma-queries for the GET [id] handler
vi.mock('../../lib/prisma-queries', () => ({
  findPersonWithDetails: vi.fn(),
  personUpdateInclude: {},
  personDetailsInclude: {},
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Import after mocking
import { POST } from '../../app/api/people/route';
import { PUT } from '../../app/api/people/[id]/route';
import { CustomFieldValidationError } from '../../lib/customFields/persistence';

const TEMPLATE_ID = 'c1234567890123456789012a';
const PERSON_ID = 'p1234567890123456789012a';

const mockPerson = {
  id: PERSON_ID,
  name: 'Alice',
  userId: 'user-123',
  groups: [],
  contactReminderEnabled: false,
  cardDavSyncEnabled: true,
  deletedAt: null,
};

describe('People API — custom field values integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: both persistence functions resolve successfully
    mocks.applyCustomFieldValues.mockResolvedValue(undefined);
    mocks.validateCustomFieldValues.mockResolvedValue(undefined);
    // Default: importantDate.count returns 0
    mocks.importantDateCount.mockResolvedValue(0);
  });

  // ─── POST /api/people ───────────────────────────────────────────────────────

  describe('POST /api/people', () => {
    it('creates the person AND calls applyCustomFieldValues for valid SELECT input', async () => {
      mocks.createPerson.mockResolvedValue({ ...mockPerson });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          relationshipToUserId: 'rel-type-1',
          customFieldValues: [{ templateId: TEMPLATE_ID, value: 'vegan' }],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.person).toBeDefined();

      // applyCustomFieldValues must have been called with the correct arguments
      expect(mocks.applyCustomFieldValues).toHaveBeenCalledWith(
        expect.anything(), // prisma
        'user-123',
        PERSON_ID,
        [{ templateId: TEMPLATE_ID, value: 'vegan' }]
      );
    });

    it('skips applyCustomFieldValues when customFieldValues is absent', async () => {
      mocks.createPerson.mockResolvedValue({ ...mockPerson });

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          relationshipToUserId: 'rel-type-1',
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(mocks.applyCustomFieldValues).not.toHaveBeenCalled();
    });

    it('returns 400 BEFORE creating the person when customFieldValues fail validation', async () => {
      // The route now calls validateCustomFieldValues before createPerson.
      // Simulate a validation failure from that pre-create check.
      mocks.validateCustomFieldValues.mockRejectedValue(
        new CustomFieldValidationError('Diet: NOT_IN_OPTIONS')
      );

      const request = new Request('http://localhost/api/people', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Alice',
          relationshipToUserId: 'rel-type-1',
          customFieldValues: [{ templateId: TEMPLATE_ID, value: 'pescatarian' }],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Diet: NOT_IN_OPTIONS');

      // The person must NOT have been created — no rollback needed
      expect(mocks.createPerson).not.toHaveBeenCalled();
      // person.delete must NOT be called — no rollback hard-delete
      expect(mocks.personDelete).not.toHaveBeenCalled();
    });
  });

  // ─── PUT /api/people/[id] ───────────────────────────────────────────────────

  describe('PUT /api/people/[id]', () => {
    const context = { params: Promise.resolve({ id: PERSON_ID }) };

    beforeEach(() => {
      mocks.personFindUnique.mockResolvedValue(mockPerson);
      mocks.updatePerson.mockResolvedValue({ ...mockPerson, name: 'Alice Updated' });
    });

    it('with empty customFieldValues [] clears all rows via applyCustomFieldValues', async () => {
      const request = new Request(`http://localhost/api/people/${PERSON_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Alice Updated',
          customFieldValues: [],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      // applyCustomFieldValues should be called with empty array (clear all)
      expect(mocks.applyCustomFieldValues).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        PERSON_ID,
        []
      );
    });

    it('with undefined customFieldValues does NOT call applyCustomFieldValues', async () => {
      const request = new Request(`http://localhost/api/people/${PERSON_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ name: 'Alice Updated' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      expect(mocks.applyCustomFieldValues).not.toHaveBeenCalled();
    });

    it('with valid customFieldValues calls applyCustomFieldValues with the correct arguments', async () => {
      const request = new Request(`http://localhost/api/people/${PERSON_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Alice Updated',
          customFieldValues: [{ templateId: TEMPLATE_ID, value: 'omnivore' }],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      expect(mocks.applyCustomFieldValues).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        PERSON_ID,
        [{ templateId: TEMPLATE_ID, value: 'omnivore' }]
      );
    });

    it('returns 400 when applyCustomFieldValues throws CustomFieldValidationError', async () => {
      mocks.applyCustomFieldValues.mockRejectedValue(
        new CustomFieldValidationError('Diet: NOT_IN_OPTIONS')
      );

      const request = new Request(`http://localhost/api/people/${PERSON_ID}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Alice Updated',
          customFieldValues: [{ templateId: TEMPLATE_ID, value: 'bad-value' }],
        }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Diet: NOT_IN_OPTIONS');
    });
  });
});
