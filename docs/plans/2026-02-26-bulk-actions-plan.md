# Bulk Actions for People List — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-select checkboxes to the people list with a floating action bar that supports bulk delete (with orphan/CardDAV handling), bulk add-to-groups, and bulk set-relationship-to-user.

**Architecture:** The server-rendered people page (`app/people/page.tsx`) gains additional data queries (groups, relationship types, CardDAV connection) and passes them to a new `PeopleListClient` client component. This client component manages selection state and renders the table, checkboxes, floating action bar, and three modal dialogs. Two new API endpoints handle bulk operations: `POST /api/people/bulk/orphans` and `POST /api/people/bulk`.

**Tech Stack:** Next.js, TypeScript, Prisma, Zod, next-intl, sonner (toasts), Tailwind CSS, Vitest

**Design doc:** `docs/plans/2026-02-26-bulk-actions-design.md`

---

## Task 1: Add i18n translation keys

All user-facing strings for bulk actions must exist in both locale files before any component work begins.

**Files:**
- Modify: `locales/en.json` — add keys under `people.bulk.*`
- Modify: `locales/es-ES.json` — add matching Spanish translations

**Step 1: Add English translations**

Add the following keys inside the `"people"` object in `locales/en.json`, after the `"connectionError"` key (around line 693):

```json
"bulk": {
  "selected": "{count} selected",
  "allSelected": "All {count} people selected",
  "selectAll": "Select all",
  "selectAllPages": "Select all {count} people",
  "clearSelection": "Clear selection",
  "addToGroups": "Add to Groups",
  "setRelationship": "Set Relationship",
  "delete": "Delete",
  "deleteTitle": "Delete {count} People",
  "deleteConfirm": "You are about to delete {count} people:",
  "deleteOrphansFound": "The following {count} people will lose all their connections and become orphans:",
  "checkingOrphans": "Checking for orphaned people...",
  "deleteToo": "Also delete these orphans",
  "deleteFromCardDav": "Also delete from CardDAV server",
  "deleteFromCardDavDescription": "If unchecked, contacts will be removed from Nametag but will remain on your CardDAV server and can be re-imported later.",
  "canRestoreWithin30Days": "You can restore deleted items within 30 days.",
  "deleting": "Deleting...",
  "deleteSuccess": "Successfully deleted {count} people",
  "deleteFailed": "Failed to delete people. Please try again.",
  "addToGroupsTitle": "Add {count} People to Groups",
  "addToGroupsDescription": "Select groups to add these people to. Existing group memberships will not be affected.",
  "adding": "Adding...",
  "addToGroupsSuccess": "Successfully added {count} people to groups",
  "addToGroupsFailed": "Failed to add people to groups. Please try again.",
  "setRelationshipTitle": "Set Relationship for {count} People",
  "setRelationshipDescription": "Choose a relationship type to assign to all selected people. This will overwrite any existing relationship.",
  "selectRelationshipType": "Select relationship type...",
  "applying": "Applying...",
  "setRelationshipSuccess": "Successfully updated relationship for {count} people",
  "setRelationshipFailed": "Failed to update relationships. Please try again.",
  "noGroupsSelected": "Select at least one group",
  "noRelationshipSelected": "Select a relationship type"
}
```

**Step 2: Add Spanish translations**

Add matching keys in `locales/es-ES.json` in the same location:

```json
"bulk": {
  "selected": "{count} seleccionados",
  "allSelected": "Todos los {count} personas seleccionadas",
  "selectAll": "Seleccionar todos",
  "selectAllPages": "Seleccionar las {count} personas",
  "clearSelection": "Limpiar selección",
  "addToGroups": "Añadir a Grupos",
  "setRelationship": "Establecer Relación",
  "delete": "Eliminar",
  "deleteTitle": "Eliminar {count} Personas",
  "deleteConfirm": "Estás a punto de eliminar {count} personas:",
  "deleteOrphansFound": "Las siguientes {count} personas perderán todas sus conexiones y quedarán huérfanas:",
  "checkingOrphans": "Comprobando personas huérfanas...",
  "deleteToo": "Eliminar también a estas personas huérfanas",
  "deleteFromCardDav": "También eliminar del servidor CardDAV",
  "deleteFromCardDavDescription": "Si no se marca, los contactos se eliminarán de Nametag pero permanecerán en tu servidor CardDAV y podrán ser reimportados más tarde.",
  "canRestoreWithin30Days": "Puedes restaurar elementos eliminados dentro de 30 días.",
  "deleting": "Eliminando...",
  "deleteSuccess": "Se eliminaron {count} personas correctamente",
  "deleteFailed": "Error al eliminar personas. Por favor, inténtalo de nuevo.",
  "addToGroupsTitle": "Añadir {count} Personas a Grupos",
  "addToGroupsDescription": "Selecciona grupos a los que añadir estas personas. Las membresías existentes no se verán afectadas.",
  "adding": "Añadiendo...",
  "addToGroupsSuccess": "Se añadieron {count} personas a grupos correctamente",
  "addToGroupsFailed": "Error al añadir personas a grupos. Por favor, inténtalo de nuevo.",
  "setRelationshipTitle": "Establecer Relación para {count} Personas",
  "setRelationshipDescription": "Elige un tipo de relación para asignar a todas las personas seleccionadas. Esto sobrescribirá cualquier relación existente.",
  "selectRelationshipType": "Seleccionar tipo de relación...",
  "applying": "Aplicando...",
  "setRelationshipSuccess": "Se actualizó la relación de {count} personas correctamente",
  "setRelationshipFailed": "Error al actualizar relaciones. Por favor, inténtalo de nuevo.",
  "noGroupsSelected": "Selecciona al menos un grupo",
  "noRelationshipSelected": "Selecciona un tipo de relación"
}
```

**Step 3: Commit**

```bash
git add locales/en.json locales/es-ES.json
git commit -m "feat: add i18n keys for bulk actions on people list"
```

---

## Task 2: Add Zod validation schemas for bulk actions

**Files:**
- Modify: `lib/validations.ts` — add bulk action schemas after `deletePersonSchema` (around line 185)
- Test: `tests/lib/validations.test.ts` — add validation tests

**Step 1: Write the failing tests**

Add to the end of `tests/lib/validations.test.ts`:

```typescript
describe('Bulk action schemas', () => {
  describe('bulkOrphansSchema', () => {
    it('should accept personIds array', () => {
      const result = bulkOrphansSchema.safeParse({ personIds: ['id1', 'id2'] });
      expect(result.success).toBe(true);
    });

    it('should accept selectAll flag', () => {
      const result = bulkOrphansSchema.safeParse({ selectAll: true });
      expect(result.success).toBe(true);
    });

    it('should reject empty object', () => {
      const result = bulkOrphansSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('bulkActionSchema', () => {
    it('should accept delete action with personIds', () => {
      const result = bulkActionSchema.safeParse({
        action: 'delete',
        personIds: ['id1'],
        deleteOrphans: false,
        deleteFromCardDav: false,
      });
      expect(result.success).toBe(true);
    });

    it('should accept addToGroups action', () => {
      const result = bulkActionSchema.safeParse({
        action: 'addToGroups',
        personIds: ['id1'],
        groupIds: ['g1'],
      });
      expect(result.success).toBe(true);
    });

    it('should accept setRelationship action', () => {
      const result = bulkActionSchema.safeParse({
        action: 'setRelationship',
        personIds: ['id1'],
        relationshipTypeId: 'rt1',
      });
      expect(result.success).toBe(true);
    });

    it('should accept selectAll flag instead of personIds', () => {
      const result = bulkActionSchema.safeParse({
        action: 'delete',
        selectAll: true,
        deleteOrphans: false,
        deleteFromCardDav: false,
      });
      expect(result.success).toBe(true);
    });

    it('should reject unknown action', () => {
      const result = bulkActionSchema.safeParse({
        action: 'unknown',
        personIds: ['id1'],
      });
      expect(result.success).toBe(false);
    });
  });
});
```

Also add the import at the top of the test file:
```typescript
import { bulkOrphansSchema, bulkActionSchema } from '../../lib/validations';
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/validations.test.ts`
Expected: FAIL — `bulkOrphansSchema` and `bulkActionSchema` are not exported.

**Step 3: Write the schemas**

Add to `lib/validations.ts` after `deletePersonSchema` (after line 185):

```typescript
// ============================================
// Bulk action schemas
// ============================================

const bulkTargetSchema = z.object({
  personIds: z.array(z.string()).optional(),
  selectAll: z.boolean().optional(),
}).refine(
  (data) => (data.personIds && data.personIds.length > 0) || data.selectAll === true,
  { message: 'Either personIds or selectAll must be provided' }
);

export const bulkOrphansSchema = bulkTargetSchema;

export const bulkActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('delete'),
    personIds: z.array(z.string()).optional(),
    selectAll: z.boolean().optional(),
    deleteOrphans: z.boolean(),
    orphanIds: z.array(z.string()).optional(),
    deleteFromCardDav: z.boolean(),
  }),
  z.object({
    action: z.literal('addToGroups'),
    personIds: z.array(z.string()).optional(),
    selectAll: z.boolean().optional(),
    groupIds: z.array(z.string()).min(1),
  }),
  z.object({
    action: z.literal('setRelationship'),
    personIds: z.array(z.string()).optional(),
    selectAll: z.boolean().optional(),
    relationshipTypeId: z.string(),
  }),
]);
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/validations.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/validations.ts tests/lib/validations.test.ts
git commit -m "feat: add Zod validation schemas for bulk people actions"
```

---

## Task 3: Bulk orphans API endpoint

**Files:**
- Create: `app/api/people/bulk/orphans/route.ts`
- Test: `tests/api/people-bulk-orphans.test.ts`

**Reference:** Existing single-person orphan endpoint at `app/api/people/[id]/orphans/route.ts` and its test at `tests/api/people-orphans.test.ts`.

**Step 1: Write the failing tests**

Create `tests/api/people-bulk-orphans.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  cardDavConnectionFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
    },
    cardDavConnection: {
      findUnique: mocks.cardDavConnectionFindUnique,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { POST } from '../../app/api/people/bulk/orphans/route';

describe('Bulk Orphans API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return orphans for multiple people', async () => {
    // Person A connects to Orphan-1 only
    // Person B connects to Orphan-2 only
    // Person C connects to Non-Orphan (who also connects to someone else)
    const allPeople = [
      {
        id: 'person-a',
        relationshipToUser: { id: 'rt1' },
        relationshipsFrom: [{ id: 'r1', relatedPersonId: 'orphan-1' }],
        relationshipsTo: [],
      },
      {
        id: 'person-b',
        relationshipToUser: { id: 'rt1' },
        relationshipsFrom: [{ id: 'r2', relatedPersonId: 'orphan-2' }],
        relationshipsTo: [],
      },
      {
        id: 'orphan-1',
        name: 'Orphan',
        surname: 'One',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [],
        relationshipsTo: [{ id: 'r1', personId: 'person-a' }],
      },
      {
        id: 'orphan-2',
        name: 'Orphan',
        surname: 'Two',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [],
        relationshipsTo: [{ id: 'r2', personId: 'person-b' }],
      },
      {
        id: 'non-orphan',
        name: 'Not',
        surname: 'Orphan',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [{ id: 'r-other', relatedPersonId: 'someone-else' }],
        relationshipsTo: [{ id: 'r3', personId: 'person-a' }],
      },
    ];

    mocks.personFindMany.mockResolvedValue(allPeople);
    mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({ personIds: ['person-a', 'person-b'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orphans).toHaveLength(2);
    expect(body.orphans.map((o: { id: string }) => o.id).sort()).toEqual(['orphan-1', 'orphan-2']);
    expect(body.hasCardDavSync).toBe(false);
  });

  it('should exclude people being deleted from orphan check', async () => {
    // Person A and Person B are connected to each other
    // Deleting both means neither should appear as orphan of the other
    const allPeople = [
      {
        id: 'person-a',
        name: 'Person',
        surname: 'A',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [{ id: 'r1', relatedPersonId: 'person-b' }],
        relationshipsTo: [],
      },
      {
        id: 'person-b',
        name: 'Person',
        surname: 'B',
        nickname: null,
        prefix: null,
        suffix: null,
        relationshipToUser: null,
        relationshipsFrom: [],
        relationshipsTo: [{ id: 'r1', personId: 'person-a' }],
      },
    ];

    mocks.personFindMany.mockResolvedValue(allPeople);
    mocks.cardDavConnectionFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({ personIds: ['person-a', 'person-b'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.orphans).toHaveLength(0);
  });

  it('should report hasCardDavSync when connection exists', async () => {
    mocks.personFindMany.mockResolvedValue([]);
    mocks.cardDavConnectionFindUnique.mockResolvedValue({ id: 'conn-1' });

    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({ personIds: ['person-a'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(body.hasCardDavSync).toBe(true);
  });

  it('should reject invalid request body', async () => {
    const request = new Request('http://localhost/api/people/bulk/orphans', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/people-bulk-orphans.test.ts`
Expected: FAIL — module not found.

**Step 3: Create the endpoint**

Create `app/api/people/bulk/orphans/route.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { formatFullName } from '@/lib/nameUtils';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest, bulkOrphansSchema } from '@/lib/validations';

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(bulkOrphansSchema, body);
    if (!validation.success) return validation.response;

    const { personIds, selectAll } = validation.data;

    // Resolve target person IDs
    let targetIds: string[];
    if (selectAll) {
      const allPeople = await prisma.person.findMany({
        where: { userId: session.user.id },
        select: { id: true },
      });
      targetIds = allPeople.map((p) => p.id);
    } else {
      targetIds = personIds!;
    }

    const targetIdSet = new Set(targetIds);

    // Fetch all people for this user with their relationships
    // We need to check who becomes an orphan when all target people are removed
    const allPeopleWithRels = await prisma.person.findMany({
      where: { userId: session.user.id },
      include: {
        relationshipToUser: { select: { id: true } },
        relationshipsFrom: {
          where: { deletedAt: null },
          select: { id: true, relatedPersonId: true },
        },
        relationshipsTo: {
          where: { deletedAt: null },
          select: { id: true, personId: true },
        },
      },
    });

    // Build a lookup map
    const peopleMap = new Map(allPeopleWithRels.map((p) => [p.id, p]));

    // Find orphans: people NOT being deleted who would lose ALL connections
    const orphans: { id: string; fullName: string }[] = [];

    for (const person of allPeopleWithRels) {
      // Skip people being deleted — they're not orphans, they're targets
      if (targetIdSet.has(person.id)) continue;

      // Skip people with a direct relationship to user
      if (person.relationshipToUser) continue;

      // Count relationships that would remain after bulk delete
      const remainingFrom = person.relationshipsFrom.filter(
        (r) => r.relatedPersonId && !targetIdSet.has(r.relatedPersonId)
      );
      const remainingTo = person.relationshipsTo.filter(
        (r) => r.personId && !targetIdSet.has(r.personId)
      );

      if (remainingFrom.length === 0 && remainingTo.length === 0) {
        // This person currently has at least one connection to a target
        const hasConnectionToTarget = [
          ...person.relationshipsFrom.filter((r) => r.relatedPersonId && targetIdSet.has(r.relatedPersonId)),
          ...person.relationshipsTo.filter((r) => r.personId && targetIdSet.has(r.personId)),
        ].length > 0;

        if (hasConnectionToTarget) {
          orphans.push({
            id: person.id,
            fullName: formatFullName(person),
          });
        }
      }
    }

    // Check if user has CardDAV sync
    const cardDavConnection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    return apiResponse.ok({
      orphans,
      hasCardDavSync: !!cardDavConnection,
    });
  } catch (error) {
    return handleApiError(error, 'people-bulk-orphans');
  }
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/people-bulk-orphans.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/people/bulk/orphans/route.ts tests/api/people-bulk-orphans.test.ts
git commit -m "feat: add bulk orphans API endpoint for aggregate orphan detection"
```

---

## Task 4: Bulk actions API endpoint

**Files:**
- Create: `app/api/people/bulk/route.ts`
- Test: `tests/api/people-bulk.test.ts`

**Reference:** Existing single-person DELETE handler at `app/api/people/[id]/route.ts:380-450`.

**Step 1: Write the failing tests**

Create `tests/api/people-bulk.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindMany: vi.fn(),
  personUpdate: vi.fn(),
  personUpdateMany: vi.fn(),
  personGroupCreateMany: vi.fn(),
  personGroupFindMany: vi.fn(),
  cardDavMappingDeleteMany: vi.fn(),
  cardDavMappingFindMany: vi.fn(),
  relationshipTypeFindUnique: vi.fn(),
  deleteContactFromCardDav: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: {
      findMany: mocks.personFindMany,
      update: mocks.personUpdate,
      updateMany: mocks.personUpdateMany,
    },
    personGroup: {
      createMany: mocks.personGroupCreateMany,
      findMany: mocks.personGroupFindMany,
    },
    cardDavMapping: {
      deleteMany: mocks.cardDavMappingDeleteMany,
      findMany: mocks.cardDavMappingFindMany,
    },
    relationshipType: {
      findUnique: mocks.relationshipTypeFindUnique,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

vi.mock('../../lib/carddav/delete-contact', () => ({
  deleteContactFromCardDav: mocks.deleteContactFromCardDav,
}));

import { POST } from '../../app/api/people/bulk/route';

describe('Bulk Actions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('delete action', () => {
    it('should soft-delete specified people', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
        { id: 'p2', userId: 'user-123' },
      ]);
      mocks.personUpdateMany.mockResolvedValue({ count: 2 });
      mocks.cardDavMappingDeleteMany.mockResolvedValue({ count: 0 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          personIds: ['p1', 'p2'],
          deleteOrphans: false,
          deleteFromCardDav: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.affectedCount).toBe(2);
      expect(mocks.personUpdateMany).toHaveBeenCalled();
    });

    it('should also delete orphans when requested', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
      ]);
      mocks.personUpdateMany
        .mockResolvedValueOnce({ count: 1 })  // main delete
        .mockResolvedValueOnce({ count: 2 }); // orphan delete
      mocks.cardDavMappingDeleteMany.mockResolvedValue({ count: 0 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'delete',
          personIds: ['p1'],
          deleteOrphans: true,
          orphanIds: ['orphan-1', 'orphan-2'],
          deleteFromCardDav: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.affectedCount).toBe(1);
      // Verify orphans were also soft-deleted
      expect(mocks.personUpdateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('addToGroups action', () => {
    it('should add people to groups avoiding duplicates', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
        { id: 'p2', userId: 'user-123' },
      ]);
      // p1 already in group g1
      mocks.personGroupFindMany.mockResolvedValue([
        { personId: 'p1', groupId: 'g1' },
      ]);
      mocks.personGroupCreateMany.mockResolvedValue({ count: 3 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'addToGroups',
          personIds: ['p1', 'p2'],
          groupIds: ['g1', 'g2'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.affectedCount).toBe(2);
    });
  });

  describe('setRelationship action', () => {
    it('should set relationship type for all selected people', async () => {
      mocks.personFindMany.mockResolvedValue([
        { id: 'p1', userId: 'user-123' },
        { id: 'p2', userId: 'user-123' },
      ]);
      mocks.relationshipTypeFindUnique.mockResolvedValue({
        id: 'rt1',
        userId: 'user-123',
      });
      mocks.personUpdateMany.mockResolvedValue({ count: 2 });

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setRelationship',
          personIds: ['p1', 'p2'],
          relationshipTypeId: 'rt1',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.affectedCount).toBe(2);
    });

    it('should reject invalid relationship type', async () => {
      mocks.relationshipTypeFindUnique.mockResolvedValue(null);

      const request = new Request('http://localhost/api/people/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action: 'setRelationship',
          personIds: ['p1'],
          relationshipTypeId: 'invalid',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });
  });

  it('should reject invalid action', async () => {
    const request = new Request('http://localhost/api/people/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid', personIds: ['p1'] }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/api/people-bulk.test.ts`
Expected: FAIL — module not found.

**Step 3: Create the endpoint**

Create `app/api/people/bulk/route.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest, bulkActionSchema } from '@/lib/validations';
import { deleteContactFromCardDav } from '@/lib/carddav/delete-contact';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('people-bulk');

async function resolvePersonIds(
  personIds: string[] | undefined,
  selectAll: boolean | undefined,
  userId: string
): Promise<string[]> {
  if (selectAll) {
    const allPeople = await prisma.person.findMany({
      where: { userId },
      select: { id: true },
    });
    return allPeople.map((p) => p.id);
  }
  // Verify all personIds belong to user
  const people = await prisma.person.findMany({
    where: { id: { in: personIds! }, userId },
    select: { id: true },
  });
  return people.map((p) => p.id);
}

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(bulkActionSchema, body);
    if (!validation.success) return validation.response;

    const data = validation.data;

    switch (data.action) {
      case 'delete': {
        const ids = await resolvePersonIds(data.personIds, data.selectAll, session.user.id);
        if (ids.length === 0) return apiResponse.ok({ success: true, affectedCount: 0 });

        // Delete from CardDAV if requested
        if (data.deleteFromCardDav) {
          const allIdsToDelete = [...ids, ...(data.orphanIds || [])];
          for (const id of allIdsToDelete) {
            await deleteContactFromCardDav(id).catch((error) => {
              log.error(
                { err: error instanceof Error ? error : new Error(String(error)), personId: id },
                'Failed to delete from CardDAV server'
              );
            });
          }
        }

        // Delete CardDAV mappings
        const allIdsForMapping = [...ids, ...(data.deleteOrphans && data.orphanIds ? data.orphanIds : [])];
        await prisma.cardDavMapping.deleteMany({
          where: { personId: { in: allIdsForMapping } },
        });

        // Soft delete the people
        const result = await prisma.person.updateMany({
          where: { id: { in: ids }, userId: session.user.id },
          data: { deletedAt: new Date() },
        });

        // Soft delete orphans if requested
        if (data.deleteOrphans && data.orphanIds && data.orphanIds.length > 0) {
          await prisma.person.updateMany({
            where: { id: { in: data.orphanIds }, userId: session.user.id },
            data: { deletedAt: new Date() },
          });
        }

        return apiResponse.ok({ success: true, affectedCount: result.count });
      }

      case 'addToGroups': {
        const ids = await resolvePersonIds(data.personIds, data.selectAll, session.user.id);
        if (ids.length === 0) return apiResponse.ok({ success: true, affectedCount: 0 });

        // Find existing memberships to avoid duplicates
        const existingMemberships = await prisma.personGroup.findMany({
          where: {
            personId: { in: ids },
            groupId: { in: data.groupIds },
          },
          select: { personId: true, groupId: true },
        });

        const existingSet = new Set(
          existingMemberships.map((m) => `${m.personId}:${m.groupId}`)
        );

        // Build new memberships, skipping existing ones
        const newMemberships: { personId: string; groupId: string }[] = [];
        for (const personId of ids) {
          for (const groupId of data.groupIds) {
            if (!existingSet.has(`${personId}:${groupId}`)) {
              newMemberships.push({ personId, groupId });
            }
          }
        }

        if (newMemberships.length > 0) {
          await prisma.personGroup.createMany({
            data: newMemberships,
            skipDuplicates: true,
          });
        }

        return apiResponse.ok({ success: true, affectedCount: ids.length });
      }

      case 'setRelationship': {
        // Validate relationship type belongs to user
        const relType = await prisma.relationshipType.findUnique({
          where: { id: data.relationshipTypeId },
          select: { id: true, userId: true },
        });

        if (!relType || relType.userId !== session.user.id) {
          return apiResponse.notFound('Relationship type not found');
        }

        const ids = await resolvePersonIds(data.personIds, data.selectAll, session.user.id);
        if (ids.length === 0) return apiResponse.ok({ success: true, affectedCount: 0 });

        const result = await prisma.person.updateMany({
          where: { id: { in: ids }, userId: session.user.id },
          data: { relationshipToUserId: data.relationshipTypeId },
        });

        return apiResponse.ok({ success: true, affectedCount: result.count });
      }
    }
  } catch (error) {
    return handleApiError(error, 'people-bulk');
  }
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/api/people-bulk.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add app/api/people/bulk/route.ts tests/api/people-bulk.test.ts
git commit -m "feat: add bulk actions API endpoint (delete, addToGroups, setRelationship)"
```

---

## Task 5: BulkDeleteModal component

**Files:**
- Create: `components/BulkDeleteModal.tsx`

**Reference:** Existing `components/DeletePersonButton.tsx` for orphan/CardDAV UI patterns and `components/ui/ConfirmationModal.tsx` for modal shell.

**Step 1: Create the component**

Create `components/BulkDeleteModal.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmationModal from './ui/ConfirmationModal';

interface Orphan {
  id: string;
  fullName: string;
}

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectAll: boolean;
  selectedNames: string[];
  onSuccess: () => void;
}

export default function BulkDeleteModal({
  isOpen,
  onClose,
  selectedIds,
  selectAll,
  selectedNames,
  onSuccess,
}: BulkDeleteModalProps) {
  const t = useTranslations('people.bulk');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<Orphan[]>([]);
  const [isLoadingOrphans, setIsLoadingOrphans] = useState(false);
  const [deleteOrphans, setDeleteOrphans] = useState(false);
  const [deleteFromCardDav, setDeleteFromCardDav] = useState(false);
  const [hasCardDavSync, setHasCardDavSync] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setDeleteOrphans(false);
      setDeleteFromCardDav(false);
      setOrphans([]);
      setIsLoadingOrphans(true);

      const controller = new AbortController();

      fetch('/api/people/bulk/orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectAll ? { selectAll: true } : { personIds: selectedIds }),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data) => {
          if (controller.signal.aborted) return;
          setOrphans(data.orphans || []);
          setHasCardDavSync(data.hasCardDavSync || false);
          setIsLoadingOrphans(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setIsLoadingOrphans(false);
        });

      return () => controller.abort();
    }
  }, [isOpen, selectedIds, selectAll]);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          ...(selectAll ? { selectAll: true } : { personIds: selectedIds }),
          deleteOrphans,
          orphanIds: orphans.map((o) => o.id),
          deleteFromCardDav,
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || t('deleteFailed'));
        setIsDeleting(false);
      }
    } catch {
      setError(t('deleteFailed'));
      setIsDeleting(false);
    }
  };

  const count = selectAll ? selectedNames.length : selectedIds.length;

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleDelete}
      title={t('deleteTitle', { count })}
      confirmText={t('delete')}
      confirmDisabled={isLoadingOrphans}
      isLoading={isDeleting}
      loadingText={t('deleting')}
      error={error}
      variant="danger"
    >
      <p className="text-muted mb-2">
        {t('deleteConfirm', { count })}
      </p>

      {selectedNames.length <= 20 && (
        <ul className="text-sm text-muted list-disc list-inside mb-3 max-h-32 overflow-y-auto">
          {selectedNames.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted mb-4">
        {t('canRestoreWithin30Days')}
      </p>

      {isLoadingOrphans && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded text-sm">
          {t('checkingOrphans')}
        </div>
      )}

      {!isLoadingOrphans && orphans.length > 0 && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-400 dark:border-yellow-800 rounded">
          <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-2">
            {t('deleteOrphansFound', { count: orphans.length })}
          </p>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mb-3 space-y-1 max-h-32 overflow-y-auto">
            {orphans.map((orphan) => (
              <li key={orphan.id}>
                <a
                  href={`/people/${orphan.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline inline-flex items-center gap-1"
                >
                  {orphan.fullName}
                  <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="bulkDeleteOrphans"
              checked={deleteOrphans}
              onChange={(e) => setDeleteOrphans(e.target.checked)}
              className="w-4 h-4 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
            />
            <label htmlFor="bulkDeleteOrphans" className="ml-2 text-sm text-yellow-800 dark:text-yellow-400 cursor-pointer">
              {t('deleteToo')}
            </label>
          </div>
        </div>
      )}

      {hasCardDavSync && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-400 dark:border-blue-800 rounded">
          <div className="flex items-start">
            <input
              type="checkbox"
              id="bulkDeleteFromCardDav"
              checked={deleteFromCardDav}
              onChange={(e) => setDeleteFromCardDav(e.target.checked)}
              className="w-4 h-4 mt-0.5 text-red-600 bg-surface-elevated border-border rounded focus:ring-red-500"
            />
            <label htmlFor="bulkDeleteFromCardDav" className="ml-2 text-sm text-blue-800 dark:text-blue-400 cursor-pointer">
              {t('deleteFromCardDav')}
            </label>
          </div>
          <p className="ml-6 mt-1 text-xs text-blue-700 dark:text-blue-300">
            {t('deleteFromCardDavDescription')}
          </p>
        </div>
      )}
    </ConfirmationModal>
  );
}
```

**Step 2: Commit**

```bash
git add components/BulkDeleteModal.tsx
git commit -m "feat: add BulkDeleteModal component with orphan and CardDAV handling"
```

---

## Task 6: BulkGroupAssignModal component

**Files:**
- Create: `components/BulkGroupAssignModal.tsx`

**Reference:** `components/GroupsSelector.tsx` for the group picker pattern.

**Step 1: Create the component**

Create `components/BulkGroupAssignModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmationModal from './ui/ConfirmationModal';
import GroupsSelector from './GroupsSelector';

interface Group {
  id: string;
  name: string;
  color: string;
}

interface BulkGroupAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectAll: boolean;
  totalCount: number;
  availableGroups: Group[];
  onSuccess: () => void;
  onGroupCreated?: (group: Group) => void;
}

export default function BulkGroupAssignModal({
  isOpen,
  onClose,
  selectedIds,
  selectAll,
  totalCount,
  availableGroups,
  onSuccess,
  onGroupCreated,
}: BulkGroupAssignModalProps) {
  const t = useTranslations('people.bulk');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = selectAll ? totalCount : selectedIds.length;

  const handleClose = () => {
    setSelectedGroupIds([]);
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (selectedGroupIds.length === 0) {
      setError(t('noGroupsSelected'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addToGroups',
          ...(selectAll ? { selectAll: true } : { personIds: selectedIds }),
          groupIds: selectedGroupIds,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('addToGroupsSuccess', { count: data.affectedCount }));
        setSelectedGroupIds([]);
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || t('addToGroupsFailed'));
        setIsSubmitting(false);
      }
    } catch {
      setError(t('addToGroupsFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={t('addToGroupsTitle', { count })}
      confirmText={t('addToGroups')}
      isLoading={isSubmitting}
      loadingText={t('adding')}
      error={error}
      variant="default"
    >
      <p className="text-sm text-muted mb-4">
        {t('addToGroupsDescription')}
      </p>
      <GroupsSelector
        availableGroups={availableGroups}
        selectedGroupIds={selectedGroupIds}
        onChange={setSelectedGroupIds}
        allowCreate={true}
        onGroupCreated={onGroupCreated}
      />
    </ConfirmationModal>
  );
}
```

**Step 2: Commit**

```bash
git add components/BulkGroupAssignModal.tsx
git commit -m "feat: add BulkGroupAssignModal component"
```

---

## Task 7: BulkRelationshipModal component

**Files:**
- Create: `components/BulkRelationshipModal.tsx`

**Reference:** Relationship dropdown in `app/carddav/import/page.tsx:72-76` for the selector pattern.

**Step 1: Create the component**

Create `components/BulkRelationshipModal.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import ConfirmationModal from './ui/ConfirmationModal';

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface BulkRelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  selectAll: boolean;
  totalCount: number;
  relationshipTypes: RelationshipType[];
  onSuccess: () => void;
}

export default function BulkRelationshipModal({
  isOpen,
  onClose,
  selectedIds,
  selectAll,
  totalCount,
  relationshipTypes,
  onSuccess,
}: BulkRelationshipModalProps) {
  const t = useTranslations('people.bulk');
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = selectAll ? totalCount : selectedIds.length;

  const handleClose = () => {
    setSelectedTypeId('');
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedTypeId) {
      setError(t('noRelationshipSelected'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/people/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setRelationship',
          ...(selectAll ? { selectAll: true } : { personIds: selectedIds }),
          relationshipTypeId: selectedTypeId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(t('setRelationshipSuccess', { count: data.affectedCount }));
        setSelectedTypeId('');
        onSuccess();
      } else {
        const data = await response.json();
        setError(data.error || t('setRelationshipFailed'));
        setIsSubmitting(false);
      }
    } catch {
      setError(t('setRelationshipFailed'));
      setIsSubmitting(false);
    }
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      title={t('setRelationshipTitle', { count })}
      confirmText={t('setRelationship')}
      isLoading={isSubmitting}
      loadingText={t('applying')}
      error={error}
      variant="default"
    >
      <p className="text-sm text-muted mb-4">
        {t('setRelationshipDescription')}
      </p>
      <select
        value={selectedTypeId}
        onChange={(e) => {
          setSelectedTypeId(e.target.value);
          setError(null);
        }}
        className="w-full px-3 py-2 border border-border rounded-lg bg-surface-elevated text-foreground focus:ring-2 focus:ring-primary focus:border-primary"
      >
        <option value="">{t('selectRelationshipType')}</option>
        {relationshipTypes.map((rt) => (
          <option key={rt.id} value={rt.id}>
            {rt.label}
          </option>
        ))}
      </select>
    </ConfirmationModal>
  );
}
```

**Step 2: Commit**

```bash
git add components/BulkRelationshipModal.tsx
git commit -m "feat: add BulkRelationshipModal component"
```

---

## Task 8: PeopleListClient component with selection state and floating action bar

This is the main client wrapper component. It renders the table (with checkboxes), the floating action bar, and wires up the three modals.

**Files:**
- Create: `components/PeopleListClient.tsx`

**Reference:** Table markup from `app/people/page.tsx:212-406` and floating bar from design doc.

**Step 1: Create the component**

Create `components/PeopleListClient.tsx`. This is the largest component — it renders the full table with checkboxes and the floating action bar.

```typescript
'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import BulkDeleteModal from './BulkDeleteModal';
import BulkGroupAssignModal from './BulkGroupAssignModal';
import BulkRelationshipModal from './BulkRelationshipModal';

interface PersonRow {
  id: string;
  name: string;
  surname: string | null;
  nickname: string | null;
  lastContact: Date | null;
  relationshipToUser: { label: string; color: string | null } | null;
  groups: Array<{ groupId: string; group: { name: string; color: string | null } }>;
  relationshipsFrom: Array<{ id: string }>;
  relationshipsTo: Array<{ id: string }>;
}

interface Group {
  id: string;
  name: string;
  color: string;
}

interface RelationshipType {
  id: string;
  label: string;
  color: string | null;
}

interface PeopleListClientProps {
  people: PersonRow[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  sortBy: string;
  order: string;
  dateFormat: string;
  availableGroups: Group[];
  relationshipTypes: RelationshipType[];
  formatDateFn: (date: Date, format: string) => string;
  translations: {
    surname: string;
    nickname: string;
    relationshipToUser: string;
    groups: string;
    lastContact: string;
    actions: string;
    indirect: string;
    orphanWarning: string;
    showing: string;
    page: string;
    of: string;
  };
  commonTranslations: {
    name: string;
    edit: string;
    view: string;
    previous: string;
    next: string;
  };
}

export default function PeopleListClient({
  people,
  totalCount,
  currentPage,
  totalPages,
  sortBy,
  order,
  dateFormat,
  availableGroups,
  relationshipTypes,
  formatDateFn,
  translations: tt,
  commonTranslations: tc,
}: PeopleListClientProps) {
  const t = useTranslations('people.bulk');
  const router = useRouter();

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);

  // Group state (for inline creation in modal)
  const [groups, setGroups] = useState<Group[]>(availableGroups);

  const pageIds = useMemo(() => people.map((p) => p.id), [people]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 || selectAllPages;

  const effectiveCount = selectAllPages ? totalCount : selectedIds.size;

  const togglePerson = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setSelectAllPages(false);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const togglePage = useCallback(() => {
    setSelectedIds((prev) => {
      if (allPageSelected) {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        setSelectAllPages(false);
        return next;
      } else {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      }
    });
  }, [allPageSelected, pageIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectAllPages(false);
  }, []);

  const handleSelectAllPages = useCallback(() => {
    setSelectAllPages(true);
    // Also select all on current page for visual consistency
    setSelectedIds(new Set(pageIds));
  }, [pageIds]);

  const selectedNames = useMemo(() => {
    if (selectAllPages) {
      return people.map((p) => p.name);
    }
    return people
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.name);
  }, [selectedIds, selectAllPages, people]);

  const handleSuccess = useCallback(() => {
    clearSelection();
    setShowDeleteModal(false);
    setShowGroupModal(false);
    setShowRelationshipModal(false);
    router.refresh();
  }, [clearSelection, router]);

  const handleDeleteSuccess = useCallback(() => {
    const count = effectiveCount;
    handleSuccess();
    toast.success(t('deleteSuccess', { count }));
  }, [effectiveCount, handleSuccess, t]);

  const handleGroupCreated = useCallback((group: Group) => {
    setGroups((prev) => [...prev, group]);
  }, []);

  // Helper to build sort URLs
  const buildSortUrl = (col: string) => {
    const params = new URLSearchParams();
    params.set('sortBy', col);
    params.set('order', sortBy === col && order === 'asc' ? 'desc' : 'asc');
    params.set('page', String(currentPage));
    return `/people?${params.toString()}`;
  };

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (sortBy !== 'name') params.set('sortBy', sortBy);
    if (order !== 'asc') params.set('order', order);
    return `/people?${params.toString()}`;
  };

  const ITEMS_PER_PAGE = 50;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  return (
    <>
      {/* Showing count */}
      <div className="mb-4 text-sm text-muted">
        {tt.showing
          .replace('{start}', String(skip + 1))
          .replace('{end}', String(Math.min(skip + ITEMS_PER_PAGE, totalCount)))
          .replace('{total}', String(totalCount))}
      </div>

      {/* Select all pages banner */}
      {allPageSelected && !selectAllPages && totalCount > people.length && (
        <div className="mb-2 p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-center">
          <button
            onClick={handleSelectAllPages}
            className="text-primary hover:underline font-medium"
          >
            {t('selectAllPages', { count: totalCount })}
          </button>
        </div>
      )}

      {selectAllPages && (
        <div className="mb-2 p-2 bg-primary/10 border border-primary/30 rounded-lg text-sm text-center">
          <span className="text-foreground font-medium">
            {t('allSelected', { count: totalCount })}
          </span>
          {' '}
          <button
            onClick={clearSelection}
            className="text-primary hover:underline"
          >
            {t('clearSelection')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface shadow-lg rounded-lg overflow-hidden border-2 border-primary/30">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-elevated">
              <tr>
                {/* Checkbox column */}
                <th className="pl-4 pr-2 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={togglePage}
                    className="w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary"
                    title={t('selectAll')}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('name')} className="flex items-center gap-1 hover:text-foreground">
                    {tc.name}
                    {sortBy === 'name' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
                <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('surname')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.surname}
                    {sortBy === 'surname' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
                <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('nickname')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.nickname}
                    {sortBy === 'nickname' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('relationship')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.relationshipToUser}
                    {sortBy === 'relationship' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('group')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.groups}
                    {sortBy === 'group' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  <Link href={buildSortUrl('lastContact')} className="flex items-center gap-1 hover:text-foreground">
                    {tt.lastContact}
                    {sortBy === 'lastContact' && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
                  </Link>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  {tt.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {people.map((person) => {
                const isOrphan = !person.relationshipToUser &&
                                 person.relationshipsFrom.length === 0 &&
                                 person.relationshipsTo.length === 0;
                const isChecked = selectAllPages || selectedIds.has(person.id);

                return (
                  <tr key={person.id} className={`hover:bg-surface-elevated transition-colors ${isChecked ? 'bg-primary/5' : ''}`}>
                    <td className="pl-4 pr-2 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePerson(person.id)}
                        className="w-4 h-4 text-primary bg-surface-elevated border-border rounded focus:ring-primary"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link href={`/people/${person.id}`} className="text-primary hover:underline font-medium">
                          {person.name}
                        </Link>
                        {isOrphan && (
                          <span className="relative group cursor-help">
                            <span className="text-yellow-500">⚠️</span>
                            <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg whitespace-normal max-w-xs z-50 shadow-lg">
                              {tt.orphanWarning}
                              <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {person.surname || '—'}
                    </td>
                    <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {person.nickname ? `'${person.nickname}'` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {person.relationshipToUser ? (
                        <span
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: person.relationshipToUser.color ? `${person.relationshipToUser.color}20` : '#E5E7EB',
                            color: person.relationshipToUser.color || '#374151',
                          }}
                        >
                          {person.relationshipToUser.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-muted bg-surface-elevated">
                          {tt.indirect}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {person.groups.map((pg) => (
                          <span
                            key={pg.groupId}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: pg.group.color ? `${pg.group.color}20` : '#E5E7EB',
                              color: pg.group.color || '#374151',
                            }}
                          >
                            {pg.group.name}
                          </span>
                        ))}
                        {person.groups.length === 0 && <span className="text-sm text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      {person.lastContact ? formatDateFn(new Date(person.lastContact), dateFormat) : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-3">
                        <Link href={`/people/${person.id}/edit`} className="text-primary hover:text-primary-dark transition-colors" title={tc.edit}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <Link href={`/people/${person.id}`} className="text-muted hover:text-foreground transition-colors" title={tc.view}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-surface px-4 py-3 border-t border-border sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                {currentPage > 1 ? (
                  <Link href={buildPageUrl(currentPage - 1)} className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-surface-elevated hover:bg-surface-elevated/80 transition-colors">
                    {tc.previous}
                  </Link>
                ) : (
                  <span className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-muted bg-surface cursor-not-allowed">
                    {tc.previous}
                  </span>
                )}
                {currentPage < totalPages ? (
                  <Link href={buildPageUrl(currentPage + 1)} className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-surface-elevated hover:bg-surface-elevated/80 transition-colors">
                    {tc.next}
                  </Link>
                ) : (
                  <span className="ml-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-muted bg-surface cursor-not-allowed">
                    {tc.next}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-foreground">
                    {tt.page} <span className="font-medium">{currentPage}</span> {tt.of}{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {currentPage > 1 ? (
                      <Link href={buildPageUrl(currentPage - 1)} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-elevated/80 transition-colors">
                        <span className="sr-only">{tc.previous}</span>←
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-surface text-sm font-medium text-muted cursor-not-allowed">
                        <span className="sr-only">{tc.previous}</span>←
                      </span>
                    )}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }
                      return pageNum === currentPage ? (
                        <span key={pageNum} className="relative inline-flex items-center px-4 py-2 border border-primary bg-primary/10 text-sm font-medium text-primary">
                          {pageNum}
                        </span>
                      ) : (
                        <Link key={pageNum} href={buildPageUrl(pageNum)} className="relative inline-flex items-center px-4 py-2 border border-border bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-elevated/80 transition-colors">
                          {pageNum}
                        </Link>
                      );
                    })}
                    {currentPage < totalPages ? (
                      <Link href={buildPageUrl(currentPage + 1)} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-surface-elevated text-sm font-medium text-foreground hover:bg-surface-elevated/80 transition-colors">
                        <span className="sr-only">{tc.next}</span>→
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-surface text-sm font-medium text-muted cursor-not-allowed">
                        <span className="sr-only">{tc.next}</span>→
                      </span>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating action bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${
          someSelected ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-surface shadow-2xl border-2 border-primary/30 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {selectAllPages
                  ? t('allSelected', { count: totalCount })
                  : t('selected', { count: selectedIds.size })}
              </span>
              <button
                onClick={clearSelection}
                className="text-muted hover:text-foreground transition-colors"
                title={t('clearSelection')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGroupModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-lg hover:bg-surface-elevated/80 transition-colors"
              >
                {t('addToGroups')}
              </button>
              <button
                onClick={() => setShowRelationshipModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-foreground bg-surface-elevated border border-border rounded-lg hover:bg-surface-elevated/80 transition-colors"
              >
                {t('setRelationship')}
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <BulkDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={selectAllPages}
        selectedNames={selectedNames}
        onSuccess={handleDeleteSuccess}
      />

      <BulkGroupAssignModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={selectAllPages}
        totalCount={totalCount}
        availableGroups={groups}
        onSuccess={handleSuccess}
        onGroupCreated={handleGroupCreated}
      />

      <BulkRelationshipModal
        isOpen={showRelationshipModal}
        onClose={() => setShowRelationshipModal(false)}
        selectedIds={Array.from(selectedIds)}
        selectAll={selectAllPages}
        totalCount={totalCount}
        relationshipTypes={relationshipTypes}
        onSuccess={handleSuccess}
      />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add components/PeopleListClient.tsx
git commit -m "feat: add PeopleListClient with selection state, floating bar, and modals"
```

---

## Task 9: Wire up the server page to use PeopleListClient

Modify `app/people/page.tsx` to:
1. Fetch groups, relationship types, and CardDAV connection status alongside existing queries
2. Replace the inline table/pagination markup with the `PeopleListClient` component
3. Pass all necessary data and serialized translations

**Files:**
- Modify: `app/people/page.tsx`

**Step 1: Update the server page**

The key changes:
1. Add parallel data fetches for groups and relationship types (add `prisma.group.findMany` and `prisma.relationshipType.findMany`)
2. Replace the entire `<>` block (lines 206-512) with a single `<PeopleListClient>` component
3. Pass serialized translation strings (since `PeopleListClient` is a client component, it can't use `getTranslations` but CAN use `useTranslations`)
4. Import and pass `formatDate` function

Replace the content of `app/people/page.tsx` with the updated version. The key structural change is:

**Before (lines 53-86)** — single `allPeople` fetch
**After** — parallel fetch of `allPeople`, `groups`, and `relationshipTypes`:

```typescript
const [allPeople, allGroups, relationshipTypes] = await Promise.all([
  prisma.person.findMany({
    where: { userId: session.user.id },
    include: {
      relationshipToUser: { select: { label: true, color: true } },
      groups: { include: { group: { select: { name: true, color: true } } } },
      relationshipsFrom: { select: { id: true } },
      relationshipsTo: { select: { id: true } },
    },
  }),
  prisma.group.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, color: true },
  }),
  prisma.relationshipType.findMany({
    where: { userId: session.user.id },
    orderBy: { label: 'asc' },
    select: { id: true, label: true, color: true },
  }),
]);
```

**Before (lines 206-512)** — inline table and pagination
**After** — single component:

```tsx
<PeopleListClient
  people={people}
  totalCount={totalCount}
  currentPage={currentPage}
  totalPages={totalPages}
  sortBy={sortBy}
  order={order}
  dateFormat={dateFormat}
  availableGroups={allGroups}
  relationshipTypes={relationshipTypes}
  formatDateFn={formatDate}
  translations={{
    surname: t('surname'),
    nickname: t('nickname'),
    relationshipToUser: t('relationshipToUser'),
    groups: t('groups'),
    lastContact: t('lastContact'),
    actions: t('actions'),
    indirect: t('indirect'),
    orphanWarning: t('orphanWarning'),
    showing: t('showing', { start: skip + 1, end: Math.min(skip + ITEMS_PER_PAGE, totalCount), total: totalCount }),
    page: t('page'),
    of: t('of'),
  }}
  commonTranslations={{
    name: tCommon('name'),
    edit: tCommon('edit'),
    view: tCommon('view'),
    previous: tCommon('previous'),
    next: tCommon('next'),
  }}
/>
```

Add import at top of file:
```typescript
import PeopleListClient from '@/components/PeopleListClient';
```

**Step 2: Run the dev server and manually verify**

Run: `npm run dev`
Check: Navigate to `/people` and verify:
- Checkboxes appear in each row
- Header checkbox selects/deselects all on page
- "Select all N people" banner appears when all page items checked
- Floating bar appears at bottom when items selected
- All three action buttons work (open their respective modals)
- Sorting still works (click column headers)
- Pagination still works

**Step 3: Run the build to check for TypeScript errors**

Run: `npm run build`
Expected: PASS with no type errors.

**Step 4: Commit**

```bash
git add app/people/page.tsx
git commit -m "feat: wire PeopleListClient into people page with bulk action support"
```

---

## Task 10: Run all existing tests and fix regressions

The page refactor may affect existing tests that import from or mock the people page.

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass. If any fail due to the refactor, fix them.

**Step 2: If any tests fail, fix and commit**

```bash
git add -A
git commit -m "fix: resolve test regressions from bulk actions refactor"
```

---

## Task 11: Manual integration test

**Step 1: Test bulk delete flow**

1. Select 2-3 people with the checkboxes
2. Click "Delete" in the floating bar
3. Verify the modal shows:
   - Names of selected people
   - Orphan detection (if applicable)
   - CardDAV checkbox (if CardDAV configured)
4. Confirm deletion
5. Verify people are removed from the list
6. Verify `router.refresh()` updates the server data

**Step 2: Test bulk add-to-groups flow**

1. Select 2-3 people
2. Click "Add to Groups"
3. Pick one or more groups (try creating a new one)
4. Confirm
5. Verify toast success message
6. Verify groups appear on the people in the list

**Step 3: Test bulk set-relationship flow**

1. Select 2-3 people
2. Click "Set Relationship"
3. Pick a relationship type
4. Confirm
5. Verify toast success message
6. Verify relationship labels update in the list

**Step 4: Test select-all-pages flow**

1. Ensure you have >50 people (or adjust ITEMS_PER_PAGE temporarily)
2. Click the header checkbox to select all on page
3. Verify the "Select all N people" banner appears
4. Click it
5. Perform any action — verify it applies to all people, not just the current page

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: bulk actions for people list - complete implementation"
```
