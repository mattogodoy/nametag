import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Prisma } from '@prisma/client';

// Use vi.hoisted to create mocks before hoisting
const mocks = vi.hoisted(() => ({
  templateFindMany: vi.fn(),
  templateFindFirst: vi.fn(),
  templateCreate: vi.fn(),
  templateUpdate: vi.fn(),
  personCustomFieldValueUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

// Mock Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    customFieldTemplate: {
      findMany: mocks.templateFindMany,
      findFirst: mocks.templateFindFirst,
      create: mocks.templateCreate,
      update: mocks.templateUpdate,
    },
    personCustomFieldValue: {
      updateMany: mocks.personCustomFieldValueUpdateMany,
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
    Promise.resolve({ allowed: true, current: 0, limit: 10, tier: 'FREE', isUnlimited: false })
  ),
}));

// Import after mocking
import { GET as listGET, POST } from '../../app/api/custom-field-templates/route';
import { GET as singleGET, PUT, DELETE } from '../../app/api/custom-field-templates/[id]/route';
import { PUT as reorderPUT } from '../../app/api/custom-field-templates/reorder/route';
import { canCreateResource } from '../../lib/billing';

const mockCanCreateResource = vi.mocked(canCreateResource);

describe('Custom Field Templates API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanCreateResource.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 10,
      tier: 'FREE' as const,
      isUnlimited: false,
    });
  });

  // ─── GET /api/custom-field-templates ────────────────────────────────────────

  describe('GET /api/custom-field-templates', () => {
    it('returns active templates for the user with 200', async () => {
      const mockTemplates = [
        {
          id: 'tpl-1',
          userId: 'user-123',
          name: 'Diet',
          slug: 'diet',
          type: 'SELECT',
          options: ['vegan', 'omnivore'],
          order: 0,
          deletedAt: null,
          _count: { values: 3 },
        },
      ];

      mocks.templateFindMany.mockResolvedValue(mockTemplates);

      const request = new Request('http://localhost/api/custom-field-templates');
      const response = await listGET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.templates).toEqual(mockTemplates);
      expect(mocks.templateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-123', deletedAt: null },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        })
      );
    });
  });

  // ─── POST /api/custom-field-templates ───────────────────────────────────────

  describe('POST /api/custom-field-templates', () => {
    it('creates a SELECT template with valid body and returns 201', async () => {
      const mockCreated = {
        id: 'tpl-new',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan', 'omnivore'],
        order: 0,
        createdAt: new Date().toISOString(),
        _count: { values: 0 },
      };

      mocks.templateFindFirst.mockResolvedValue(null); // no existing templates (for order calc)
      mocks.templateCreate.mockResolvedValue(mockCreated);

      const request = new Request('http://localhost/api/custom-field-templates', {
        method: 'POST',
        body: JSON.stringify({ name: 'Diet', type: 'SELECT', options: ['vegan', 'omnivore'] }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.template).toEqual(mockCreated);

      // Slug derived from name
      expect(mocks.templateCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'diet',
            order: 0,
            userId: 'user-123',
          }),
        })
      );
    });

    it('returns 403 when tier limit is reached', async () => {
      mockCanCreateResource.mockResolvedValue({
        allowed: false,
        current: 5,
        limit: 5,
        tier: 'FREE' as const,
        isUnlimited: false,
      });

      const request = new Request('http://localhost/api/custom-field-templates', {
        method: 'POST',
        body: JSON.stringify({ name: 'Diet', type: 'TEXT' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(403);
      expect(body.error).toContain('5');
    });

    it('returns 400 when derived slug is empty (e.g. name is "???")', async () => {
      const request = new Request('http://localhost/api/custom-field-templates', {
        method: 'POST',
        body: JSON.stringify({ name: '???', type: 'TEXT' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Name must contain at least one alphanumeric character');
    });

    it('returns 409 when Prisma throws P2002 (unique constraint on [userId, slug])', async () => {
      mocks.templateFindFirst.mockResolvedValue(null);
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });
      mocks.templateCreate.mockRejectedValue(p2002);

      const request = new Request('http://localhost/api/custom-field-templates', {
        method: 'POST',
        body: JSON.stringify({ name: 'Diet', type: 'TEXT' }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toContain('already exists');
    });
  });

  // ─── GET /api/custom-field-templates/[id] ───────────────────────────────────

  describe('GET /api/custom-field-templates/[id]', () => {
    it('returns 200 with the template when it belongs to the user', async () => {
      const mockTemplate = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan'],
        order: 0,
        deletedAt: null,
        _count: { values: 2 },
      };

      mocks.templateFindFirst.mockResolvedValue(mockTemplate);

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1');
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await singleGET(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.template).toEqual(mockTemplate);
    });

    it('returns 404 when the template is not found or belongs to another user', async () => {
      mocks.templateFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/custom-field-templates/unknown');
      const context = { params: Promise.resolve({ id: 'unknown' }) };
      const response = await singleGET(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBeDefined();
    });
  });

  // ─── PUT /api/custom-field-templates/[id] ───────────────────────────────────

  describe('PUT /api/custom-field-templates/[id]', () => {
    it('updates name only and does NOT change slug', async () => {
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'TEXT',
        options: [],
        order: 0,
        deletedAt: null,
      };

      const updated = { ...existing, name: 'Eating Habits' };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Eating Habits' }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.template).toEqual(updated);

      // Slug must NOT be in the update data
      expect(mocks.templateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ slug: expect.anything() }),
        })
      );
      // Name must be updated
      expect(mocks.templateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Eating Habits' }),
        })
      );
    });

    it('returns 400 when body is empty ({})', async () => {
      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation failed');
    });

    it('renames cascade when one option swapped for another', async () => {
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan', 'omnivore'],
        order: 0,
        deletedAt: null,
      };

      const updated = { ...existing, options: ['plant-based', 'omnivore'] };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue(updated);
      mocks.personCustomFieldValueUpdateMany.mockResolvedValue({ count: 2 });

      // Simulate $transaction calling the callback with a tx object
      mocks.transaction.mockImplementation(
        async (fn: (tx: { customFieldTemplate: { update: typeof mocks.templateUpdate }; personCustomFieldValue: { updateMany: typeof mocks.personCustomFieldValueUpdateMany } }) => Promise<unknown>) => {
          const tx = {
            customFieldTemplate: { update: mocks.templateUpdate },
            personCustomFieldValue: { updateMany: mocks.personCustomFieldValueUpdateMany },
          };
          return fn(tx);
        }
      );

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({ options: ['plant-based', 'omnivore'] }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(200);

      // $transaction must have been called
      expect(mocks.transaction).toHaveBeenCalled();

      // updateMany must have been called for the renamed option
      expect(mocks.personCustomFieldValueUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateId: 'tpl-1',
            value: 'vegan',
          }),
          data: { value: 'plant-based' },
        })
      );

      // updateMany must NOT have been called for unchanged options
      expect(mocks.personCustomFieldValueUpdateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ value: 'omnivore' }),
        })
      );
    });

    it('rename + add in same request does not cascade (ambiguous — 1 removed, 2 added)', async () => {
      // When one option is removed and two new ones appear, it is ambiguous which
      // added option represents the rename target. The cascade is skipped to avoid
      // silently mis-routing existing person values. The old positional approach
      // also dropped the rename here (length mismatch), but for the wrong reason.
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan', 'omnivore'],
        order: 0,
        deletedAt: null,
      };

      const updated = { ...existing, options: ['plant-based', 'omnivore', 'pescatarian'] };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({ options: ['plant-based', 'omnivore', 'pescatarian'] }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.personCustomFieldValueUpdateMany).not.toHaveBeenCalled();
    });

    it('pure add does not cascade', async () => {
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan', 'omnivore'],
        order: 0,
        deletedAt: null,
      };

      const updated = { ...existing, options: ['vegan', 'omnivore', 'pescatarian'] };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({ options: ['vegan', 'omnivore', 'pescatarian'] }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.personCustomFieldValueUpdateMany).not.toHaveBeenCalled();
    });

    it('pure remove does not cascade and does not error', async () => {
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan', 'omnivore'],
        order: 0,
        deletedAt: null,
      };

      const updated = { ...existing, options: ['omnivore'] };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({ options: ['omnivore'] }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.personCustomFieldValueUpdateMany).not.toHaveBeenCalled();
    });

    it('ambiguous multi-rename does not cascade', async () => {
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'SELECT',
        options: ['vegan', 'omnivore'],
        order: 0,
        deletedAt: null,
      };

      const updated = { ...existing, options: ['plant-based', 'meat-eater'] };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue(updated);

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify({ options: ['plant-based', 'meat-eater'] }),
        headers: { 'content-type': 'application/json' },
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await PUT(request, context);

      expect(response.status).toBe(200);
      expect(mocks.transaction).not.toHaveBeenCalled();
      expect(mocks.personCustomFieldValueUpdateMany).not.toHaveBeenCalled();
    });
  });

  // ─── DELETE /api/custom-field-templates/[id] ────────────────────────────────

  describe('DELETE /api/custom-field-templates/[id]', () => {
    it('soft-deletes the template and returns 200 with { success: true }', async () => {
      const existing = {
        id: 'tpl-1',
        userId: 'user-123',
        name: 'Diet',
        slug: 'diet',
        type: 'TEXT',
        options: [],
        order: 0,
        deletedAt: null,
      };

      mocks.templateFindFirst.mockResolvedValue(existing);
      mocks.templateUpdate.mockResolvedValue({ ...existing, deletedAt: new Date() });

      const request = new Request('http://localhost/api/custom-field-templates/tpl-1', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'tpl-1' }) };
      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // Must set deletedAt (soft delete), not call delete
      expect(mocks.templateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        })
      );
    });

    it('returns 404 when the template does not exist or already deleted', async () => {
      mocks.templateFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost/api/custom-field-templates/nonexistent', {
        method: 'DELETE',
      });
      const context = { params: Promise.resolve({ id: 'nonexistent' }) };
      const response = await DELETE(request, context);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBeDefined();
    });
  });

  // ─── PUT /api/custom-field-templates/reorder ────────────────────────────────

  describe('PUT /api/custom-field-templates/reorder', () => {
    it('reorders templates and returns 200 with { success: true } (full list submitted)', async () => {
      const id1 = 'c1111111111111111111111a';
      const id2 = 'c2222222222222222222222a';
      const id3 = 'c3333333333333333333333a';

      const a = { id: id1, userId: 'user-123' };
      const b = { id: id2, userId: 'user-123' };
      const c = { id: id3, userId: 'user-123' };

      // Mock findMany returns all 3 active templates (full set)
      mocks.templateFindMany.mockResolvedValue([a, b, c]);

      // Mock transaction with update calls
      mocks.transaction.mockImplementation(
        async (updates: Array<unknown>) => {
          return Promise.all(updates.map((u) => u));
        }
      );

      const request = new Request('http://localhost/api/custom-field-templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ids: [id3, id1, id2] }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await reorderPUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      // Verify active templates were loaded for ownership+completeness check
      expect(mocks.templateFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-123',
            deletedAt: null,
          },
          select: { id: true },
        })
      );

      // Verify transaction was called with 3 update calls
      expect(mocks.transaction).toHaveBeenCalled();
      const transactionArg = (mocks.transaction as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0];
      expect(transactionArg).toHaveLength(3);
    });

    it('returns 400 when a subset of active template ids is submitted', async () => {
      const id1 = 'c1111111111111111111111a';
      const id2 = 'c2222222222222222222222a';
      const id3 = 'c3333333333333333333333a';

      // User has 3 active templates but submits only 2
      mocks.templateFindMany.mockResolvedValue([
        { id: id1 }, { id: id2 }, { id: id3 },
      ]);

      const request = new Request('http://localhost/api/custom-field-templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ids: [id1, id2] }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await reorderPUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Reorder must include all active templates');
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('returns 400 when extra or foreign ids are submitted', async () => {
      const id1 = 'c1111111111111111111111a';
      const id2 = 'c2222222222222222222222a';
      const foreignId = 'cforeign111111111111111a';

      // User has 2 active templates but submits 2 with one foreign id
      mocks.templateFindMany.mockResolvedValue([
        { id: id1 }, { id: id2 },
      ]);

      const request = new Request('http://localhost/api/custom-field-templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ids: [id1, foreignId] }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await reorderPUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Reorder must include all active templates');
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('returns 400 when ids that do not belong to the user are submitted', async () => {
      const id1 = 'c1111111111111111111111a';
      const foreignId = 'cforeign111111111111111a';

      // User has 1 active template; submitted list has 2 (one foreign)
      mocks.templateFindMany.mockResolvedValue([{ id: id1 }]);

      const request = new Request('http://localhost/api/custom-field-templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ids: [id1, foreignId] }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await reorderPUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Reorder must include all active templates');
      expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it('returns 400 when ids array is empty (validation fails)', async () => {
      const request = new Request('http://localhost/api/custom-field-templates/reorder', {
        method: 'PUT',
        body: JSON.stringify({ ids: [] }),
        headers: { 'content-type': 'application/json' },
      });

      const response = await reorderPUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Validation failed');

      // Verify findMany was NOT called (validation should fail first)
      expect(mocks.templateFindMany).not.toHaveBeenCalled();
      expect(mocks.transaction).not.toHaveBeenCalled();
    });
  });
});
