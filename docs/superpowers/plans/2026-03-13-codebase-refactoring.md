# Codebase Refactoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Nametag codebase to eliminate duplication, extract service layers, and decompose large components — making the code easier to maintain and extend.

**Architecture:** Bottom-up refactoring in 3 tiers. Tier 1 builds foundational abstractions (query helpers, person service, generic field manager). Tier 2 uses those abstractions to simplify existing code (PersonForm decomposition, route slimming, vCard consolidation). Tier 3 handles independent polish (OpenAPI splitting, component test coverage).

**Tech Stack:** Next.js, TypeScript, Prisma, React, Vitest, React Testing Library, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-13-codebase-refactoring-design.md`

---

## Chunk 1: Prisma Query Helpers (Tier 1, Task 1)

### Task 1: Prisma Query Helpers

**Files:**
- Create: `lib/prisma/queries.ts`
- Create: `tests/lib/prisma/queries.test.ts`
- Reference: `lib/prisma.ts` (existing Prisma client with soft-delete extension)
- Reference: `app/api/people/[id]/graph/route.ts:23-117` (nested include to extract)
- Reference: `app/api/dashboard/graph/route.ts:75-144` (select structure to extract)
- Reference: `app/api/people/route.ts:42-81` (GET include structure)
- Reference: `app/api/people/[id]/route.ts:335-358` (update include structure)

**Context:** The Prisma client extension in `lib/prisma.ts:31-88` auto-injects `deletedAt: null` for top-level queries. The query helpers focus on **nested include builders** that encapsulate deep soft-delete filtering, and **ownership-scoped where clauses** that repeat across 20+ routes. The `withDeleted()` function (`lib/prisma.ts:110`) is for restore/trash operations — never use the query helpers for those.

- [ ] **Step 1: Write tests for `personWhere` helper**

```typescript
// tests/lib/prisma/queries.test.ts
import { describe, it, expect } from 'vitest';
import { personWhere } from '@/lib/prisma/queries';

describe('personWhere', () => {
  it('returns ownership-scoped where clause', () => {
    const where = personWhere('person-123', 'user-456');
    expect(where).toEqual({
      id: 'person-123',
      userId: 'user-456',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/prisma/queries.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `lib/prisma/queries.ts` with `personWhere`**

```typescript
// lib/prisma/queries.ts
import { prisma } from '@/lib/prisma';

/**
 * Ownership-scoped where clause for a person.
 * Top-level soft-delete filtering is handled by the Prisma client extension.
 * Do NOT use these helpers for restore/trash — use withDeleted() directly.
 */
export function personWhere(id: string, userId: string) {
  return { id, userId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/prisma/queries.test.ts`
Expected: PASS

- [ ] **Step 5: Write tests for `softDeletedRelationsFilter` include helpers**

Add to `tests/lib/prisma/queries.test.ts`:

```typescript
import {
  personWhere,
  personDetailsInclude,
  personGraphInclude,
  personRelationshipsInclude,
} from '@/lib/prisma/queries';

describe('personDetailsInclude', () => {
  it('includes multi-value fields with soft-delete filters on relations', () => {
    const include = personDetailsInclude();
    // Verify groups include matches existing codebase pattern (group: true, not select)
    expect(include.groups).toMatchObject({
      include: { group: true },
      where: { group: { deletedAt: null } },
    });
    // Verify multi-value fields are included
    expect(include.phoneNumbers).toBe(true);
    expect(include.emails).toBe(true);
    expect(include.addresses).toBe(true);
    expect(include.urls).toBe(true);
    expect(include.imHandles).toBe(true);
    expect(include.locations).toBe(true);
    expect(include.customFields).toBe(true);
    // Verify important dates are filtered and ordered
    expect(include.importantDates).toMatchObject({
      where: { deletedAt: null },
      orderBy: { date: 'asc' },
    });
  });
});

describe('personRelationshipsInclude', () => {
  it('includes relationships with nested soft-delete filters', () => {
    const include = personRelationshipsInclude();
    expect(include.relationshipsFrom).toMatchObject({
      where: { deletedAt: null, relatedPerson: { deletedAt: null } },
    });
    // The nested relatedPerson should also filter its relationships
    const relatedPersonInclude =
      include.relationshipsFrom.include.relatedPerson.include;
    expect(relatedPersonInclude.groups).toMatchObject({
      where: { group: { deletedAt: null } },
    });
  });
});

describe('personGraphInclude', () => {
  it('includes deep nested structure for graph rendering', () => {
    const include = personGraphInclude();
    // Should include relationships
    expect(include.relationshipsFrom).toBeDefined();
    // Should include relatedPerson with their own relationships
    const relatedPerson = include.relationshipsFrom.include.relatedPerson;
    expect(relatedPerson).toBeDefined();
    expect(relatedPerson.include.relationshipsFrom).toBeDefined();
    // RelationshipType includes should have inverse
    const relType = include.relationshipsFrom.include.relationshipType;
    expect(relType.include.inverse).toBeDefined();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run tests/lib/prisma/queries.test.ts`
Expected: FAIL — functions not exported

- [ ] **Step 7: Implement include builders**

Study the existing include structures in these files, then build the helpers:
- `app/api/people/[id]/graph/route.ts:23-117` — the deepest nested include (graph)
- `app/api/people/route.ts:42-81` — the GET handler's conditional includes (details)
- `app/api/people/[id]/route.ts:335-358` — the update response include
- `app/api/people/merge/route.ts:11-24` — the `personFullInclude` constant

Add to `lib/prisma/queries.ts`:

```typescript
/**
 * Include for multi-value person fields (phones, emails, etc).
 * These don't have soft-delete, so no filtering needed.
 */
function multiValueFieldsInclude() {
  return {
    phoneNumbers: true,
    emails: true,
    addresses: true,
    urls: true,
    imHandles: true,
    locations: true,
    customFields: true,
  } as const;
}

/**
 * Include for groups with soft-delete filtering on the group itself.
 */
function groupsInclude() {
  return {
    groups: {
      include: { group: true },
      where: { group: { deletedAt: null } },
    },
  } as const;
}

/**
 * Include for important dates with soft-delete filtering and ordering.
 */
function importantDatesInclude() {
  return {
    importantDates: {
      where: { deletedAt: null },
      orderBy: { date: 'asc' as const },
    },
  };
}

/**
 * Include for relationshipToUser.
 */
function relationshipToUserInclude() {
  return {
    relationshipToUser: {
      include: {
        inverse: true,
      },
      where: { deletedAt: null },
    },
  };
}

/**
 * Details include: multi-value fields + groups + important dates + relationshipToUser.
 * Used by person detail views and update response.
 */
export function personDetailsInclude() {
  return {
    ...multiValueFieldsInclude(),
    ...groupsInclude(),
    ...importantDatesInclude(),
    ...relationshipToUserInclude(),
    // Include relationshipsTo for person detail page (used to show incoming relationships)
    relationshipsTo: { where: { deletedAt: null }, select: { id: true } },
  };
}

/**
 * Relationships include: relationships with nested relatedPerson details.
 * Used by person detail page and relationship views.
 */
export function personRelationshipsInclude() {
  return {
    relationshipsFrom: {
      where: { deletedAt: null, relatedPerson: { deletedAt: null } },
      include: {
        relatedPerson: {
          include: {
            ...groupsInclude(),
            ...relationshipToUserInclude(),
          },
        },
        relationshipType: {
          include: { inverse: true },
        },
      },
    },
  };
}

/**
 * Graph include: deep nested structure for force-directed graph rendering.
 * Encapsulates the 100+ line include blocks from graph routes.
 * Extract the exact structure from app/api/people/[id]/graph/route.ts:23-117.
 */
export function personGraphInclude() {
  return {
    ...relationshipToUserInclude(),
    ...groupsInclude(),
    relationshipsFrom: {
      where: { deletedAt: null, relatedPerson: { deletedAt: null } },
      include: {
        relatedPerson: {
          include: {
            ...relationshipToUserInclude(),
            ...groupsInclude(),
            relationshipsFrom: {
              where: { deletedAt: null, relatedPerson: { deletedAt: null } },
              include: {
                relationshipType: {
                  include: {
                    inverse: { where: { deletedAt: null } },
                  },
                  where: { deletedAt: null },
                },
              },
            },
          },
        },
        relationshipType: {
          include: {
            inverse: { where: { deletedAt: null } },
          },
          where: { deletedAt: null },
        },
      },
    },
  };
}
```

**Important:** The exact shapes above are approximations based on the exploration. When implementing, **read the actual include structures** from the reference files and match them exactly. The structure must produce the same query results as the existing code.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run tests/lib/prisma/queries.test.ts`
Expected: PASS

- [ ] **Step 9: Write tests for finder functions**

Add to `tests/lib/prisma/queries.test.ts` — use `vi.hoisted()` for reliable mocking:

```typescript
import { vi, beforeEach } from 'vitest';

// Use vi.hoisted for reliable mock setup
const mockPrisma = vi.hoisted(() => ({
  person: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

import { findPersonById, findPersonWithDetails } from '@/lib/prisma/queries';

describe('findPersonById', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls findUnique with ownership-scoped where', async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: 'p1', name: 'Test' });

    await findPersonById('p1', 'u1');

    expect(mockPrisma.person.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1', userId: 'u1' },
    });
  });
});

describe('findPersonWithDetails', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls findUnique with details include', async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: 'p1' });

    await findPersonWithDetails('p1', 'u1');

    const call = mockPrisma.person.findUnique.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'p1', userId: 'u1' });
    expect(call.include.phoneNumbers).toBe(true);
    expect(call.include.groups).toBeDefined();
    expect(call.include.importantDates).toBeDefined();
    expect(call.include.relationshipsTo).toBeDefined();
  });
});
```

- [ ] **Step 10: Implement finder functions**

Add to `lib/prisma/queries.ts`:

```typescript
/**
 * Find a person by ID with ownership check.
 */
export function findPersonById(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
  });
}

/**
 * Find a person with all detail fields (multi-value, groups, dates).
 */
export function findPersonWithDetails(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
    include: personDetailsInclude(),
  });
}

/**
 * Find a person with relationships and related person details.
 */
export function findPersonWithRelationships(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
    include: {
      ...personDetailsInclude(),
      ...personRelationshipsInclude(),
    },
  });
}

/**
 * Find a person with full graph include structure.
 */
export function findPersonForGraph(id: string, userId: string) {
  return prisma.person.findUnique({
    where: personWhere(id, userId),
    include: personGraphInclude(),
  });
}

/**
 * Find all people for a user with optional includes.
 * For search/groupId filtering, routes build their own queries —
 * this helper standardizes the base query and include patterns.
 */
export function findPeopleByUser(
  userId: string,
  options?: {
    includeDetails?: boolean;
    orderBy?: Record<string, 'asc' | 'desc'>;
    where?: Record<string, unknown>;  // additional where clauses (search, group filter)
  }
) {
  return prisma.person.findMany({
    where: { userId, ...options?.where },
    include: options?.includeDetails ? personDetailsInclude() : undefined,
    orderBy: options?.orderBy,
  });
}

/**
 * Count people for a user.
 */
export function countPeopleByUser(userId: string) {
  return prisma.person.count({
    where: { userId },
  });
}
```

- [ ] **Step 11: Run all tests**

Run: `npx vitest run tests/lib/prisma/queries.test.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add lib/prisma/queries.ts tests/lib/prisma/queries.test.ts
git commit -m "feat: add Prisma query helpers for person lookups and nested includes"
```

---

## Chunk 2: Person Service Layer (Tier 1, Task 2)

### Task 2: Person Service Layer

**Files:**
- Create: `lib/services/person.ts`
- Create: `tests/lib/services/person.test.ts`
- Reference: `app/api/people/route.ts:94-385` (POST — creation logic to extract)
- Reference: `app/api/people/[id]/route.ts:66-390` (PUT — update logic to extract)
- Reference: `app/api/people/merge/route.ts:27-469` (merge logic to extract)
- Reference: `lib/sanitize.ts` (sanitizeName, sanitizeNotes, sanitizeObject)
- Reference: `lib/validations.ts:125-177` (createPersonSchema, updatePersonSchema)
- Reference: `lib/carddav/auto-export.ts` (autoExportPerson, autoUpdatePerson)
- Depends on: Task 1 (uses query helpers for includes)

**Context:** The service layer owns all Person domain logic: create, update, delete, restore, merge. It accepts `PersonInput` matching the Zod validation output shape and transforms it into Prisma nested writes. Routes call the service after handling HTTP concerns (auth, parsing, validation, billing).

- [ ] **Step 1: Define the `PersonInput` type**

Read `lib/validations.ts:125-177` to extract the exact shape of `createPersonSchema`. The `PersonInput` type should match its inferred output.

Add to `lib/services/person.ts`:

```typescript
// lib/services/person.ts
import { z } from 'zod';
import { createPersonSchema } from '@/lib/validations';

/**
 * Input type matching the Zod validation output.
 * The service transforms this into Prisma nested writes.
 */
export type PersonInput = z.infer<typeof createPersonSchema>;
```

- [ ] **Step 2: Write test for `createPerson` — basic scalar fields**

```typescript
// tests/lib/services/person.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  person: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  cardDavConnection: {
    findFirst: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/carddav/auto-export', () => ({
  autoExportPerson: vi.fn(),
  autoUpdatePerson: vi.fn(),
}));

import { createPerson } from '@/lib/services/person';

describe('createPerson', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a person with sanitized scalar fields', async () => {
    mockPrisma.person.create.mockResolvedValue({ id: 'new-id', name: 'John' });
    mockPrisma.cardDavConnection.findFirst.mockResolvedValue(null);

    await createPerson('user-1', {
      name: 'John',
      surname: 'Doe',
      notes: 'Some <script>bad</script> notes',
    });

    const createCall = mockPrisma.person.create.mock.calls[0][0];
    expect(createCall.data.name).toBe('John');
    expect(createCall.data.surname).toBe('Doe');
    // Uses user: { connect: { id } } pattern per existing codebase
    expect(createCall.data.user).toEqual({ connect: { id: 'user-1' } });
    // Notes should be sanitized (script tag removed)
    expect(createCall.data.notes).not.toContain('<script>');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/lib/services/person.test.ts`
Expected: FAIL — createPerson not found

- [ ] **Step 4: Implement `createPerson` — scalar fields and nested writes**

Study `app/api/people/route.ts:112-320` for the exact creation mapping. Extract into `lib/services/person.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { personDetailsInclude } from '@/lib/prisma/queries';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { autoExportPerson } from '@/lib/carddav/auto-export';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('person-service');

export async function createPerson(userId: string, data: PersonInput) {
  // Sanitize text fields
  const name = sanitizeName(data.name) || data.name;
  const surname = data.surname ? sanitizeName(data.surname) : null;
  const middleName = data.middleName ? sanitizeName(data.middleName) : null;
  const secondLastName = data.secondLastName ? sanitizeName(data.secondLastName) : null;
  const nickname = data.nickname ? sanitizeName(data.nickname) : null;
  const prefix = data.prefix ? sanitizeName(data.prefix) : null;
  const suffix = data.suffix ? sanitizeName(data.suffix) : null;
  const organization = data.organization ? sanitizeName(data.organization) : null;
  const jobTitle = data.jobTitle ? sanitizeName(data.jobTitle) : null;
  const notes = data.notes ? sanitizeNotes(data.notes) : null;

  // Build nested creation data
  // Extract the exact mapping from app/api/people/route.ts:192-320
  // This includes: groups, importantDates, phoneNumbers, emails,
  // addresses, urls, imHandles, locations, customFields, relationshipToUser
  const personData = {
    user: { connect: { id: userId } },
    name,
    surname,
    middleName,
    secondLastName,
    nickname,
    prefix,
    suffix,
    uid: data.uid || undefined,
    organization,
    jobTitle,
    gender: data.gender || null,
    anniversary: data.anniversary || null,
    lastContact: data.lastContact || null,
    notes,
    contactReminderEnabled: data.contactReminderEnabled ?? false,
    contactReminderInterval: data.contactReminderInterval ?? null,
    contactReminderIntervalUnit: data.contactReminderIntervalUnit ?? null,
    cardDavSyncEnabled: data.cardDavSyncEnabled ?? false,
    // Nested creates for multi-value fields
    ...(data.groupIds?.length ? {
      groups: {
        create: data.groupIds.map((gId: string) => ({ groupId: gId })),
      },
    } : {}),
    ...(data.phoneNumbers?.length ? {
      phoneNumbers: {
        create: data.phoneNumbers.map((p) => ({
          type: p.type,
          number: p.number,
          isPrimary: p.isPrimary ?? false,
        })),
      },
    } : {}),
    // ... (same pattern for emails, addresses, urls, imHandles, locations, customFields, importantDates)
    // Extract the EXACT mapping from app/api/people/route.ts
    ...(data.relationshipToUserId ? {
      relationshipToUser: { connect: { id: data.relationshipToUserId } },
    } : {}),
  };

  const person = await prisma.person.create({
    data: personData,
    include: personDetailsInclude(),
  });

  // Auto-export to CardDAV if connection exists (background, non-blocking)
  autoExportPerson(person.id).catch((error) => {
    log.error({ error, personId: person.id }, 'Auto-export failed');
  });

  return person;
}
```

**Important:** The code above shows the structure. When implementing, **read the full creation logic from `app/api/people/route.ts:192-320`** and extract ALL nested creation mappings exactly. Do not omit any fields.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/lib/services/person.test.ts`
Expected: PASS

- [ ] **Step 6: Write test for `createPerson` — nested multi-value fields**

```typescript
it('creates nested phone numbers and emails', async () => {
  mockPrisma.person.create.mockResolvedValue({ id: 'new-id', name: 'Jane' });
  mockPrisma.cardDavConnection.findFirst.mockResolvedValue(null);

  await createPerson('user-1', {
    name: 'Jane',
    phoneNumbers: [
      { type: 'mobile', number: '+1234567890' },
    ],
    emails: [
      { type: 'work', email: 'jane@work.com' },
    ],
  });

  const createData = mockPrisma.person.create.mock.calls[0][0].data;
  expect(createData.phoneNumbers.create).toHaveLength(1);
  expect(createData.phoneNumbers.create[0].number).toBe('+1234567890');
  expect(createData.emails.create).toHaveLength(1);
  expect(createData.emails.create[0].email).toBe('jane@work.com');
});
```

- [ ] **Step 7: Run test and verify it passes (implementation from Step 4 should handle this)**

Run: `npx vitest run tests/lib/services/person.test.ts`
Expected: PASS

- [ ] **Step 8: Write test for `updatePerson`**

```typescript
import { updatePerson } from '@/lib/services/person';

describe('updatePerson', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates scalar fields with sanitization', async () => {
    mockPrisma.person.findUnique.mockResolvedValue({
      id: 'p1', userId: 'u1', name: 'Old', cardDavSyncEnabled: false,
    });
    mockPrisma.person.update.mockResolvedValue({ id: 'p1', name: 'New' });

    await updatePerson('p1', 'u1', { name: 'New' });

    expect(mockPrisma.person.update).toHaveBeenCalled();
    const updateData = mockPrisma.person.update.mock.calls[0][0].data;
    expect(updateData.name).toBe('New');
  });

  it('uses deleteMany + create pattern for multi-value fields', async () => {
    mockPrisma.person.findUnique.mockResolvedValue({
      id: 'p1', userId: 'u1', name: 'Test', cardDavSyncEnabled: false,
    });
    mockPrisma.person.update.mockResolvedValue({ id: 'p1' });

    await updatePerson('p1', 'u1', {
      phoneNumbers: [{ type: 'mobile', number: '555-1234' }],
    });

    const updateData = mockPrisma.person.update.mock.calls[0][0].data;
    expect(updateData.phoneNumbers.deleteMany).toEqual({});
    expect(updateData.phoneNumbers.create).toHaveLength(1);
  });

  it('throws if person not found', async () => {
    mockPrisma.person.findUnique.mockResolvedValue(null);

    await expect(updatePerson('p1', 'u1', { name: 'X' })).rejects.toThrow();
  });
});
```

- [ ] **Step 9: Implement `updatePerson`**

Study `app/api/people/[id]/route.ts:66-390` for the exact update mapping. Extract the `deleteMany + create` pattern for all multi-value fields and the CardDAV sync toggle logic.

```typescript
export async function updatePerson(
  id: string,
  userId: string,
  data: Partial<PersonInput>
) {
  // Verify ownership
  const existing = await prisma.person.findUnique({
    where: personWhere(id, userId),
  });
  if (!existing) {
    throw new Error('Person not found');
  }

  // Build update data — extract EXACT mapping from app/api/people/[id]/route.ts:154-332
  // Uses deleteMany + create pattern for multi-value fields
  const updateData = buildUpdateData(data);

  const person = await prisma.person.update({
    where: { id },
    data: updateData,
    include: personDetailsInclude(),
  });

  // Handle CardDAV sync toggle — extract from app/api/people/[id]/route.ts:360-384
  handleCardDavSyncToggle(person, existing, id);

  return person;
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run tests/lib/services/person.test.ts`
Expected: PASS

- [ ] **Step 11: Write test for `deletePerson` and `restorePerson`**

```typescript
import { deletePerson, restorePerson } from '@/lib/services/person';

describe('deletePerson', () => {
  it('soft-deletes by setting deletedAt', async () => {
    mockPrisma.person.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    mockPrisma.person.update.mockResolvedValue({ id: 'p1' });

    await deletePerson('p1', 'u1');

    const updateCall = mockPrisma.person.update.mock.calls[0][0];
    expect(updateCall.data.deletedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 12: Implement `deletePerson` and `restorePerson`**

Extract the soft-delete logic from the existing DELETE handler. `restorePerson` should use `withDeleted()` from `lib/prisma.ts` since it needs to find soft-deleted records.

- [ ] **Step 13: Run all service tests**

Run: `npx vitest run tests/lib/services/person.test.ts`
Expected: PASS

- [ ] **Step 14: Write test for `mergePeople`**

```typescript
import { mergePeople } from '@/lib/services/person';

describe('mergePeople', () => {
  it('merges source into target and soft-deletes source', async () => {
    // Mock both people with full details
    const target = { id: 'target', userId: 'u1', name: 'Target', phoneNumbers: [] };
    const source = { id: 'source', userId: 'u1', name: 'Source', phoneNumbers: [{ number: '555' }] };
    mockPrisma.person.findUnique
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(source);
    mockPrisma.person.update.mockResolvedValue({ ...target });

    await mergePeople('target', 'source', 'u1', {});

    // Source should be soft-deleted
    const lastUpdate = mockPrisma.person.update.mock.calls.at(-1)[0];
    // Verify merge operations were performed
    expect(mockPrisma.person.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 15: Implement `mergePeople`**

Extract the merge logic from `app/api/people/merge/route.ts:27-469`. This is the most complex operation:
1. Fetch both people with full includes
2. CardDAV server delete attempts for source
3. Build field override updates
4. Deduplicate multi-value fields
5. Filter relationship transfers
6. Execute transaction block
7. Post-transaction cleanup

**Important:** Read the full merge route carefully. The transaction logic (lines 302-424) must be preserved exactly.

- [ ] **Step 16: Run all service tests**

Run: `npx vitest run tests/lib/services/person.test.ts`
Expected: PASS

- [ ] **Step 17: Commit**

```bash
git add lib/services/person.ts tests/lib/services/person.test.ts
git commit -m "feat: add person service layer for create, update, delete, merge"
```

---

## Chunk 3: Generic Field Manager Component (Tier 1, Task 3)

### Task 3: Generic Field Manager Component

**Files:**
- Create: `components/fields/FieldManager.tsx`
- Create: `lib/field-configs.ts`
- Create: `tests/components/fields/FieldManager.test.tsx`
- Reference: `components/PersonPhoneManager.tsx` (pattern to extract)
- Reference: `components/PersonEmailManager.tsx` (pattern to extract)
- Reference: `components/PersonAddressManager.tsx` (multi-field pattern)
- Reference: `components/PersonUrlManager.tsx` (URL safety check)
- Reference: `components/PersonLocationManager.tsx` (lat/lon validation)
- Reference: `components/PersonCustomFieldManager.tsx` (freeform key, presets)
- Migrate: `tests/components/PersonPhoneManager.test.tsx`
- Migrate: `tests/components/PersonEmailManager.test.tsx`
- Migrate: `tests/components/PersonAddressManager.test.tsx`
- Migrate: `tests/components/PersonUrlManager.test.tsx`
- Independent of: Tasks 1-2

**Context:** Six field manager components follow near-identical patterns (list items, add/edit/delete with type selector). The generic FieldManager replaces all six with a single configurable component. Each field type provides a config object. Edge cases: Address has multi-field layout, Location has lat/lon with coordinate validation, CustomField has freeform key with X- prefix normalization.

- [ ] **Step 1: Define the `FieldConfig` type interface**

```typescript
// lib/field-configs.ts
import { ReactNode } from 'react';

export interface FieldDefinition<T> {
  key: keyof T & string;
  type: 'text' | 'tel' | 'email' | 'url' | 'number';
  placeholder?: string;
  required?: boolean;
  label?: string;
  /** For number inputs */
  min?: number;
  max?: number;
  step?: string;
  /** Custom render function — overrides default input */
  renderField?: (item: T, onChange: (item: T) => void) => ReactNode;
  /** Grid column span (default 1) */
  colSpan?: number;
}

export interface FieldConfig<T> {
  typeOptions?: string[];
  defaultType?: string;
  fields: FieldDefinition<T>[];
  emptyItem: () => T;
  /** Number of grid columns for the field layout (default 1) */
  gridCols?: number;
  /** Whether the item has an editable key field (for custom fields) */
  keyEditable?: boolean;
  keyField?: keyof T & string;
  /** Presets for key selection (for custom fields) */
  presets?: string[];
  /** Validation function — return error message or null */
  validate?: (item: T) => string | null;
  /** Format function for display mode */
  formatDisplay?: (item: T) => string;
  /** Color accent class for theming */
  accentColor?: string;
}
```

- [ ] **Step 2: Write test for FieldManager — basic phone config**

Port the core behaviors from `tests/components/PersonPhoneManager.test.tsx`:

```typescript
// tests/components/fields/FieldManager.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import FieldManager from '@/components/fields/FieldManager';
import { phoneFieldConfig } from '@/lib/field-configs';

const messages = {/* load from locales/en.json */};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('FieldManager with phone config', () => {
  it('renders empty state message', () => {
    renderWithIntl(
      <FieldManager
        items={[]}
        onChange={vi.fn()}
        fieldConfig={phoneFieldConfig}
        labels={{ add: 'Add phone', empty: 'No phones added' }}
      />
    );
    expect(screen.getByText('No phones added')).toBeInTheDocument();
  });

  it('displays existing items', () => {
    const phones = [
      { type: 'mobile', number: '+1234567890', isPrimary: false },
    ];
    renderWithIntl(
      <FieldManager
        items={phones}
        onChange={vi.fn()}
        fieldConfig={phoneFieldConfig}
        labels={{ add: 'Add phone', empty: 'No phones' }}
      />
    );
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
  });

  it('calls onChange when adding an item', async () => {
    const onChange = vi.fn();
    renderWithIntl(
      <FieldManager
        items={[]}
        onChange={onChange}
        fieldConfig={phoneFieldConfig}
        labels={{ add: 'Add phone', empty: 'No phones' }}
      />
    );

    fireEvent.click(screen.getByText('Add phone'));
    // Fill in the phone number field
    const input = screen.getByPlaceholderText(/phone/i);
    fireEvent.change(input, { target: { value: '555-1234' } });
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /save|add|confirm/i }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ number: '555-1234', type: 'mobile' }),
    ]);
  });

  it('calls onChange when removing an item', () => {
    const onChange = vi.fn();
    const phones = [
      { type: 'mobile', number: '555-0000', isPrimary: false },
      { type: 'work', number: '555-1111', isPrimary: false },
    ];
    renderWithIntl(
      <FieldManager
        items={phones}
        onChange={onChange}
        fieldConfig={phoneFieldConfig}
        labels={{ add: 'Add phone', empty: 'No phones' }}
      />
    );

    // Click delete on first item
    const deleteButtons = screen.getAllByRole('button', { name: /delete|remove/i });
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledWith([phones[1]]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/components/fields/FieldManager.test.tsx`
Expected: FAIL — components not found

- [ ] **Step 4: Implement `FieldManager.tsx` core**

Study `components/PersonPhoneManager.tsx` for the exact UI pattern, then generalize:

```typescript
// components/fields/FieldManager.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FieldConfig } from '@/lib/field-configs';

interface FieldManagerProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  fieldConfig: FieldConfig<T>;
  labels: {
    add: string;
    empty: string;
  };
}

export default function FieldManager<T extends Record<string, unknown>>({
  items,
  onChange,
  fieldConfig,
  labels,
}: FieldManagerProps<T>) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<T>(fieldConfig.emptyItem());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<T | null>(null);

  // Implement: handleAdd, handleStartEdit, handleSaveEdit, handleCancelEdit, handleRemove
  // Follow the exact UI pattern from PersonPhoneManager.tsx
  // Render: type selector (if typeOptions), field inputs (from config.fields), action buttons
  // Support: keyEditable mode, custom renderField slots, multi-column grid layout
  // ...
}
```

**Important:** Read each existing manager component to understand all UI behaviors. The FieldManager must replicate:
- Triple-state UI: viewing, editing, adding (from PersonPhoneManager pattern)
- Type dropdown with capitalized labels (from all managers)
- Multi-field grid layout (from PersonAddressManager, `gridCols` config)
- Custom render slots via `renderField` (for Location lat/lon)
- Freeform key with X- prefix normalization (from PersonCustomFieldManager)
- Validation before save (from all managers)
- Translations via `useTranslations`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/fields/FieldManager.test.tsx`
Expected: PASS

- [ ] **Step 6: Implement field configs for all 6 types**

Add to `lib/field-configs.ts`:

```typescript
// Phone config — extracted from PersonPhoneManager.tsx
export const phoneFieldConfig: FieldConfig<PersonPhone> = {
  typeOptions: ['Mobile', 'Home', 'Work', 'Fax', 'Other'],
  defaultType: 'Mobile',
  fields: [
    { key: 'number', type: 'tel', placeholder: 'Phone number', required: true },
  ],
  emptyItem: () => ({ type: 'Mobile', number: '' }),
  accentColor: 'blue',
};

// Email config — extracted from PersonEmailManager.tsx
// Note: default type is 'Personal' not 'Home'
export const emailFieldConfig: FieldConfig<PersonEmail> = {
  typeOptions: ['Personal', 'Work', 'Other'],
  defaultType: 'Personal',
  fields: [
    { key: 'email', type: 'email', placeholder: 'Email address', required: true },
  ],
  emptyItem: () => ({ type: 'Personal', email: '' }),
  accentColor: 'purple',
};

// Address config — multi-field layout from PersonAddressManager.tsx
export const addressFieldConfig: FieldConfig<PersonAddress> = {
  typeOptions: ['Home', 'Work', 'Other'],
  defaultType: 'Home',
  gridCols: 2,
  fields: [
    { key: 'streetLine1', type: 'text', placeholder: 'Street line 1', colSpan: 2 },
    { key: 'streetLine2', type: 'text', placeholder: 'Street line 2', colSpan: 2 },
    { key: 'locality', type: 'text', placeholder: 'City' },
    { key: 'region', type: 'text', placeholder: 'State/Province' },
    { key: 'postalCode', type: 'text', placeholder: 'Postal code' },
    { key: 'country', type: 'text', placeholder: 'Country', renderField: /* country dropdown */ },
  ],
  emptyItem: () => ({
    type: 'Home', streetLine1: '', streetLine2: '', locality: '',
    region: '', postalCode: '', country: '',
  }),
  validate: (addr) => {
    const hasAny = addr.streetLine1 || addr.locality || addr.region || addr.postalCode || addr.country;
    return hasAny ? null : 'At least one address field is required';
  },
  accentColor: 'orange',
};

// URL config — from PersonUrlManager.tsx
export const urlFieldConfig: FieldConfig<PersonUrl> = {
  typeOptions: ['Personal', 'Work', 'Other'],
  defaultType: 'Personal',
  fields: [
    { key: 'url', type: 'url', placeholder: 'https://...', required: true },
  ],
  emptyItem: () => ({ type: 'Personal', url: '' }),
  accentColor: 'cyan',
};

// Location config — from PersonLocationManager.tsx
export const locationFieldConfig: FieldConfig<PersonLocation> = {
  typeOptions: ['home', 'work', 'other'],
  defaultType: 'home',
  gridCols: 2,
  fields: [
    { key: 'label', type: 'text', placeholder: 'Label (optional)', colSpan: 2 },
    {
      key: 'latitude', type: 'number', placeholder: 'Latitude',
      min: -90, max: 90, step: '0.000001', required: true,
    },
    {
      key: 'longitude', type: 'number', placeholder: 'Longitude',
      min: -180, max: 180, step: '0.000001', required: true,
    },
  ],
  emptyItem: () => ({ type: 'home', latitude: 0, longitude: 0, label: '' }),
  validate: (loc) => {
    if (loc.latitude < -90 || loc.latitude > 90) return 'Invalid latitude';
    if (loc.longitude < -180 || loc.longitude > 180) return 'Invalid longitude';
    return null;
  },
  accentColor: 'emerald',
};

// Custom field config — from PersonCustomFieldManager.tsx
export const customFieldFieldConfig: FieldConfig<PersonCustomField> = {
  keyEditable: true,
  keyField: 'key',
  presets: [
    'X-SPOUSE', 'X-MANAGER', 'X-ASSISTANT', 'X-TWITTER',
    'X-LINKEDIN', 'X-FACEBOOK', 'X-INSTAGRAM', 'X-GITHUB', 'X-CUSTOM',
  ],
  fields: [
    { key: 'value', type: 'text', placeholder: 'Value', required: true },
  ],
  emptyItem: () => ({ key: '', value: '', type: '' }),
  accentColor: 'purple',
};
```

**Important:** Read each existing component carefully when implementing to get exact type options, default types, color schemes, and validation logic.

- [ ] **Step 7: Write tests for address config (multi-field)**

```typescript
describe('FieldManager with address config', () => {
  it('renders multi-field layout for address', () => {
    renderWithIntl(
      <FieldManager
        items={[]}
        onChange={vi.fn()}
        fieldConfig={addressFieldConfig}
        labels={{ add: 'Add address', empty: 'No addresses' }}
      />
    );
    fireEvent.click(screen.getByText('Add address'));
    // Should show multiple fields
    expect(screen.getByPlaceholderText('Street line 1')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('City')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Postal code')).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Write tests for custom field config (freeform key)**

```typescript
describe('FieldManager with custom field config', () => {
  it('shows preset selector and normalizes key with X- prefix', async () => {
    const onChange = vi.fn();
    renderWithIntl(
      <FieldManager
        items={[]}
        onChange={onChange}
        fieldConfig={customFieldFieldConfig}
        labels={{ add: 'Add field', empty: 'No custom fields' }}
      />
    );
    fireEvent.click(screen.getByText('Add field'));
    // Select a preset
    // Fill value
    // Verify key is normalized
  });
});
```

- [ ] **Step 9: Run all FieldManager tests**

Run: `npx vitest run tests/components/fields/FieldManager.test.tsx`
Expected: PASS

- [ ] **Step 10: Migrate existing field manager tests**

Read `tests/components/PersonPhoneManager.test.tsx`, `PersonEmailManager.test.tsx`, `PersonAddressManager.test.tsx`, `PersonUrlManager.test.tsx`. Add equivalent test cases to `tests/components/fields/FieldManager.test.tsx` that test the same behaviors through `FieldManager` + configs:

- Phone: empty state, display existing, add with default type Mobile, custom type, remove, edit
- Email: default type Personal (not Home), no Home option
- Address: country dropdown, ISO codes, multi-field, null handling
- URL: clickable links, safe URL check, Personal/Work/Other only

- [ ] **Step 11: Run all FieldManager tests including migrated**

Run: `npx vitest run tests/components/fields/FieldManager.test.tsx`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add components/fields/FieldManager.tsx lib/field-configs.ts tests/components/fields/FieldManager.test.tsx
git commit -m "feat: add generic FieldManager component with configs for all field types"
```

---

## Chunk 4: PersonForm Decomposition (Tier 2, Task 4)

### Task 4: PersonForm Decomposition

**Files:**
- Create: `components/person-form/PersonForm.tsx` (new orchestrator)
- Create: `components/person-form/PersonalInfoSection.tsx`
- Create: `components/person-form/PhotoSection.tsx`
- Create: `components/person-form/WorkInfoSection.tsx`
- Create: `components/person-form/NotesSection.tsx`
- Create: `components/person-form/DatesSection.tsx`
- Create: `components/person-form/GroupsSection.tsx`
- Create: `components/person-form/RelationshipsSection.tsx`
- Create: `components/person-form/MultiValueSection.tsx`
- Create: `hooks/usePersonForm.ts`
- Modify: `components/PersonForm.tsx` (will be replaced by re-export)
- Create: `tests/components/person-form/MultiValueSection.test.tsx`
- Depends on: Task 3 (uses FieldManager)

**Context:** PersonForm.tsx is 1,212 lines with 18 useState hooks. We decompose it into section components with a useReducer-based custom hook. Migration is incremental — start with MultiValueSection (uses FieldManager from Task 3), then extract other sections one at a time.

- [ ] **Step 1: Create the `usePersonForm` hook with reducer**

Read `components/PersonForm.tsx:148-248` to catalog all useState hooks and their types. Build the reducer:

```typescript
// hooks/usePersonForm.ts
import { useReducer, useCallback } from 'react';

// Define action types based on all 18 useState calls in PersonForm.tsx
type PersonFormAction =
  | { type: 'SET_FIELD'; field: string; value: unknown }
  | { type: 'SET_FORM_DATA'; data: Partial<FormData> }
  | { type: 'SET_PHONES'; phones: PersonPhone[] }
  | { type: 'SET_EMAILS'; emails: PersonEmail[] }
  | { type: 'SET_ADDRESSES'; addresses: PersonAddress[] }
  | { type: 'SET_URLS'; urls: PersonUrl[] }
  | { type: 'SET_IMPORTANT_DATES'; dates: ImportantDate[] }
  | { type: 'SET_PHOTO_PREVIEW'; preview: string | null }
  | { type: 'SET_PHOTO_REMOVED'; removed: boolean }
  | { type: 'SET_PENDING_PHOTO_BLOB'; blob: Blob | null }
  | { type: 'SET_CROP_IMAGE_SRC'; src: string | null }
  | { type: 'SET_SHOW_PHOTO_SOURCE_MODAL'; show: boolean }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET'; person: PersonFormProps['person'] };

// Build state shape matching all current useState values
interface PersonFormState {
  formData: { /* all fields from PersonForm.tsx:170-190 */ };
  phoneNumbers: PersonPhone[];
  emails: PersonEmail[];
  addresses: PersonAddress[];
  urls: PersonUrl[];
  importantDates: ImportantDate[];
  photoPreview: string | null;
  photoRemoved: boolean;
  pendingPhotoBlob: Blob | null;
  cropImageSrc: string | null;
  showPhotoSourceModal: boolean;
  knownThroughId: string;
  knownThroughName: string;
  inheritGroups: boolean;
  showDropdown: boolean;
  isLoading: boolean;
  error: string;
}

// Hook returns state + scoped setter callbacks
export function usePersonForm(initialPerson?: PersonFormProps['person']) {
  const [state, dispatch] = useReducer(personFormReducer, buildInitialState(initialPerson));

  // Scoped setters — section components use these, not dispatch
  const setName = useCallback((name: string) =>
    dispatch({ type: 'SET_FORM_DATA', data: { name } }), []);
  const setPhones = useCallback((phones: PersonPhone[]) =>
    dispatch({ type: 'SET_PHONES', phones }), []);
  // ... same pattern for all fields

  return { state, setName, setPhones, setEmails, /* ... all setters */ };
}
```

**Important:** Read `PersonForm.tsx:148-248` to get the exact initial state derivation from `person` prop. The RESET action must replicate this logic for edit mode.

- [ ] **Step 2: Write test for usePersonForm hook**

```typescript
// tests/hooks/usePersonForm.test.ts
import { renderHook, act } from '@testing-library/react';
import { usePersonForm } from '@/hooks/usePersonForm';

describe('usePersonForm', () => {
  it('initializes with empty state for create mode', () => {
    const { result } = renderHook(() => usePersonForm());
    expect(result.current.state.formData.name).toBe('');
    expect(result.current.state.phoneNumbers).toEqual([]);
  });

  it('initializes from existing person for edit mode', () => {
    const person = { name: 'John', surname: 'Doe', phoneNumbers: [{ number: '555' }] };
    const { result } = renderHook(() => usePersonForm(person));
    expect(result.current.state.formData.name).toBe('John');
  });

  it('setter callbacks update state correctly', () => {
    const { result } = renderHook(() => usePersonForm());
    act(() => result.current.setPhones([{ type: 'mobile', number: '555' }]));
    expect(result.current.state.phoneNumbers).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test and verify it fails**

Run: `npx vitest run tests/hooks/usePersonForm.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement usePersonForm hook**

- [ ] **Step 5: Run test and verify it passes**

Run: `npx vitest run tests/hooks/usePersonForm.test.ts`
Expected: PASS

- [ ] **Step 6: Commit hook**

```bash
git add hooks/usePersonForm.ts tests/hooks/usePersonForm.test.ts
git commit -m "feat: add usePersonForm hook with reducer for centralized form state"
```

- [ ] **Step 7: Extract MultiValueSection**

This is the first section to extract because it uses the new FieldManager from Task 3.

```typescript
// components/person-form/MultiValueSection.tsx
'use client';

import FieldManager from '@/components/fields/FieldManager';
import {
  phoneFieldConfig,
  emailFieldConfig,
  addressFieldConfig,
  urlFieldConfig,
  locationFieldConfig,
  customFieldFieldConfig,
} from '@/lib/field-configs';
import { useTranslations } from 'next-intl';

interface MultiValueSectionProps {
  phoneNumbers: PersonPhone[];
  emails: PersonEmail[];
  addresses: PersonAddress[];
  urls: PersonUrl[];
  locations: PersonLocation[];
  customFields: PersonCustomField[];
  onPhonesChange: (phones: PersonPhone[]) => void;
  onEmailsChange: (emails: PersonEmail[]) => void;
  onAddressesChange: (addresses: PersonAddress[]) => void;
  onUrlsChange: (urls: PersonUrl[]) => void;
  onLocationsChange: (locations: PersonLocation[]) => void;
  onCustomFieldsChange: (fields: PersonCustomField[]) => void;
}

export default function MultiValueSection({ /* props */ }: MultiValueSectionProps) {
  const t = useTranslations('people.form');
  return (
    <>
      {/* Contact Information */}
      <FieldManager items={phoneNumbers} onChange={onPhonesChange}
        fieldConfig={phoneFieldConfig} labels={{ add: t('addPhone'), empty: t('noPhones') }} />
      <FieldManager items={emails} onChange={onEmailsChange}
        fieldConfig={emailFieldConfig} labels={{ add: t('addEmail'), empty: t('noEmails') }} />
      {/* Location */}
      <FieldManager items={addresses} onChange={onAddressesChange}
        fieldConfig={addressFieldConfig} labels={{ add: t('addAddress'), empty: t('noAddresses') }} />
      {/* Websites */}
      <FieldManager items={urls} onChange={onUrlsChange}
        fieldConfig={urlFieldConfig} labels={{ add: t('addUrl'), empty: t('noUrls') }} />
      {/* Locations (lat/lon) — newly wired, was previously unused */}
      <FieldManager items={locations} onChange={onLocationsChange}
        fieldConfig={locationFieldConfig} labels={{ add: t('addLocation'), empty: t('noLocations') }} />
      {/* Custom Fields — newly wired, was previously unused */}
      <FieldManager items={customFields} onChange={onCustomFieldsChange}
        fieldConfig={customFieldFieldConfig} labels={{ add: t('addCustomField'), empty: t('noCustomFields') }} />
    </>
  );
}
```

**Important:** Check locale files (`locales/en.json`, etc.) for existing translation keys. Add new keys for Location and CustomField sections if they don't exist. Remember to add translations to ALL 6 locale files per CLAUDE.md rules.

- [ ] **Step 8: Write test for MultiValueSection**

```typescript
// tests/components/person-form/MultiValueSection.test.tsx
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import MultiValueSection from '@/components/person-form/MultiValueSection';

describe('MultiValueSection', () => {
  it('renders all 6 field managers', () => {
    // Render with empty arrays, verify all empty state messages appear
  });
});
```

- [ ] **Step 9: Run test and verify it passes**

Run: `npx vitest run tests/components/person-form/MultiValueSection.test.tsx`
Expected: PASS

- [ ] **Step 10: Commit MultiValueSection**

```bash
git add components/person-form/MultiValueSection.tsx tests/components/person-form/MultiValueSection.test.tsx
git commit -m "feat: extract MultiValueSection from PersonForm using FieldManager"
```

- [ ] **Step 11: Extract remaining sections one at a time**

For each section, follow the same pattern: create component → write test → verify → commit.

**PersonalInfoSection** (from PersonForm.tsx "Personal Information Section" ~lines 533-834):
- Receives: name, surname, middleName, secondLastName, nickname, prefix, suffix, gender + setters
- Includes the relationship-to-user selector and "known through" autocomplete
- File: `components/person-form/PersonalInfoSection.tsx`

**PhotoSection** (from PersonForm.tsx ~lines 453-530):
- Receives: photo state (preview, removed, blob, cropSrc, showModal) + setters
- Imports PhotoCropModal, PhotoSourceModal, PersonAvatar
- File: `components/person-form/PhotoSection.tsx`

**WorkInfoSection** (from PersonForm.tsx "Work Information Section" ~lines 837-880):
- Receives: organization, jobTitle + setters
- File: `components/person-form/WorkInfoSection.tsx`

**NotesSection** (from PersonForm.tsx ~lines 1061-1076):
- Receives: notes + setter
- Imports MarkdownEditor
- File: `components/person-form/NotesSection.tsx`

**DatesSection** (from PersonForm.tsx ~lines 1048-1059):
- Wraps ImportantDatesManager
- File: `components/person-form/DatesSection.tsx`

**GroupsSection** (from PersonForm.tsx ~lines 915-939):
- Wraps GroupsSelector
- File: `components/person-form/GroupsSection.tsx`

**RelationshipsSection** (from PersonForm.tsx ~lines 941-1046 — last contact + relationship to user):
- Receives: lastContact, relationshipToUserId, reminder settings + setters
- File: `components/person-form/RelationshipsSection.tsx`

For each: read the exact lines from PersonForm.tsx, extract JSX + handlers, replace in PersonForm with the section component.

- [ ] **Step 12: Create the orchestrator PersonForm**

After all sections are extracted, the orchestrator at `components/person-form/PersonForm.tsx` should be ~200-250 lines:

```typescript
// components/person-form/PersonForm.tsx
'use client';

import { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { usePersonForm } from '@/hooks/usePersonForm';
import PersonalInfoSection from './PersonalInfoSection';
import PhotoSection from './PhotoSection';
import WorkInfoSection from './WorkInfoSection';
import NotesSection from './NotesSection';
import DatesSection from './DatesSection';
import GroupsSection from './GroupsSection';
import RelationshipsSection from './RelationshipsSection';
import MultiValueSection from './MultiValueSection';

export default function PersonForm(props: PersonFormProps) {
  const { state, ...setters } = usePersonForm(props.person);
  const t = useTranslations('people.form');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent, addAnother?: boolean) => {
    // Extract from PersonForm.tsx:321-443
    // Construct payload from state, call API, handle photo, redirect
  };

  return (
    <form onSubmit={(e) => handleSubmit(e)}>
      <PhotoSection {...photoProps} />
      <PersonalInfoSection {...personalInfoProps} />
      <WorkInfoSection {...workInfoProps} />
      <MultiValueSection {...multiValueProps} />
      <GroupsSection {...groupProps} />
      <RelationshipsSection {...relationshipProps} />
      <DatesSection {...dateProps} />
      {/* Submit buttons — extract from PersonForm.tsx:1142-1210 */}
    </form>
  );
}
```

- [ ] **Step 13: Update import path — re-export from old location**

```typescript
// components/PersonForm.tsx (existing file — replace contents with re-export)
export { default } from './person-form/PersonForm';
export type { PersonFormProps } from './person-form/PersonForm';
```

This ensures all existing imports still work without updating every consumer.

- [ ] **Step 14: Run existing tests to verify no regressions**

Run: `npx vitest run`
Expected: All existing tests PASS

- [ ] **Step 15: Delete old field manager components (after FieldManager is fully integrated)**

Once PersonForm and all consumers use FieldManager, remove:
- `components/PersonPhoneManager.tsx`
- `components/PersonEmailManager.tsx`
- `components/PersonAddressManager.tsx`
- `components/PersonUrlManager.tsx`
- `components/PersonLocationManager.tsx`
- `components/PersonCustomFieldManager.tsx`
- `tests/components/PersonPhoneManager.test.tsx`
- `tests/components/PersonEmailManager.test.tsx`
- `tests/components/PersonAddressManager.test.tsx`
- `tests/components/PersonUrlManager.test.tsx`

**Important:** Before deleting, grep for any remaining imports of these components outside PersonForm. If any exist, update them to use FieldManager + config first.

- [ ] **Step 16: Commit PersonForm decomposition**

```bash
git add components/person-form/ hooks/usePersonForm.ts components/PersonForm.tsx
git add -u  # stage deletions of old managers
git commit -m "refactor: decompose PersonForm into section components with useReducer state"
```

---

## Chunk 5: API Route Slimming (Tier 2, Task 5)

### Task 5: API Route Slimming

**Files:**
- Modify: `app/api/people/route.ts` (385 → ~30 lines)
- Modify: `app/api/people/[id]/route.ts` (464 → ~35 lines)
- Modify: `app/api/people/merge/route.ts` (469 → ~40 lines)
- Modify: `app/api/dashboard/graph/route.ts` (use query helpers)
- Modify: `app/api/people/[id]/graph/route.ts` (use query helpers)
- Create: `lib/services/reminders.ts` (from cron/send-reminders)
- Create: `lib/services/import.ts` (from user/import)
- Modify: `app/api/cron/send-reminders/route.ts` (484 → ~30 lines)
- Modify: `app/api/user/import/route.ts` (360 → ~40 lines)
- Depends on: Tasks 1 + 2

**Context:** Routes become thin HTTP handlers: parse → validate → billing check → call service → return response. All domain logic lives in the service layer.

- [ ] **Step 1: Migrate POST /api/people to use person service**

Read `app/api/people/route.ts:94-385`. Replace the creation logic (lines 112-385) with a call to `createPerson()`:

```typescript
// After: app/api/people/route.ts POST handler
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(createPersonSchema, body);
    if (!validation.success) return validation.response;

    // Billing check (extract from current lines ~145-180)
    if (isSaasMode()) {
      const usage = await canCreateResource(session.user.id, 'person');
      if (!usage.allowed) return apiResponse.forbidden(usage.message);
    }

    // createPerson handles: sanitization, nested writes, CardDAV auto-export.
    // It does NOT handle: connectedThroughId relationships or photo upload.
    // These stay in the route because they are request-specific concerns.
    const person = await createPerson(session.user.id, validation.data);

    // Handle connectedThroughId relationship — stays in route
    // Extract from current lines ~346-371: validate base person exists,
    // create bidirectional relationships between new person and base person
    if (validation.data.connectedThroughId) {
      await createConnectionRelationship(
        person.id, validation.data.connectedThroughId, session.user.id
      );
    }

    // Photo handling stays in route — extract from current lines ~333-343
    // Data URI to file conversion, separate from person creation

    return apiResponse.created(person);
  } catch (error) {
    return handleApiError(error, 'Create person');
  }
});
```

- [ ] **Step 2: Run existing people API tests**

Run: `npx vitest run tests/api/people.test.ts`
Expected: PASS — behavior should be identical

- [ ] **Step 3: Migrate PUT /api/people/[id] to use person service**

Read `app/api/people/[id]/route.ts:66-390`. Replace update logic with `updatePerson()`.

- [ ] **Step 4: Run existing people/[id] tests**

Run: `npx vitest run tests/api/people.test.ts`
Expected: PASS

- [ ] **Step 5: Migrate POST /api/people/merge to use person service**

Read `app/api/people/merge/route.ts:27-469`. Replace merge logic with `mergePeople()`.

- [ ] **Step 6: Run existing merge tests**

Run: `npx vitest run tests/api/people-merge.test.ts`
Expected: PASS

- [ ] **Step 7: Commit people route slimming**

```bash
git add app/api/people/route.ts app/api/people/\\[id\\]/route.ts app/api/people/merge/route.ts
git commit -m "refactor: slim people routes using person service layer"
```

- [ ] **Step 8: Migrate graph routes to use query helpers**

Replace the 100+ line include blocks in both graph routes:

```typescript
// app/api/people/[id]/graph/route.ts — replace lines 17-118 with:
import { findPersonForGraph } from '@/lib/prisma/queries';

const person = await findPersonForGraph(id, session.user.id);
```

```typescript
// app/api/dashboard/graph/route.ts — keeps its custom select structure
// The dashboard route uses `select` (not `include`) for performance optimization.
// It stays as-is because converting select to include would fetch more data than needed.
// Only app/api/people/[id]/graph/route.ts uses the query helper.
```

**Decision:** The dashboard graph route keeps its own `select` structure. Only the person graph route uses `findPersonForGraph()`. If the dashboard select structure needs to change in the future, a `personGraphSelect()` helper can be added then.

- [ ] **Step 9: Run graph-related tests**

Run: `npx vitest run tests/api/dashboard.test.ts tests/api/people-graph.test.ts`
Expected: PASS (if these test files exist)

- [ ] **Step 10: Commit graph route cleanup**

```bash
git add app/api/dashboard/graph/route.ts app/api/people/\\[id\\]/graph/route.ts
git commit -m "refactor: use query helpers for graph route includes"
```

- [ ] **Step 11: Extract reminders service**

Create `lib/services/reminders.ts` from `app/api/cron/send-reminders/route.ts`:
- Move `shouldSendImportantDateReminder()` (lines 275-393)
- Move `getIntervalMs()` (lines 395-410)
- Move `shouldSendContactReminder()` (lines 412-453)
- Move `formatInterval()` (lines 455-462)
- Move `formatDateForEmail()` (lines 464-484)
- Move the main processing loop (lines 46-229)

Export a single `processReminders()` function that the cron route calls.

- [ ] **Step 12: Extract import service**

Create `lib/services/import.ts` from `app/api/user/import/route.ts`:
- Move the 4-step import logic (lines 133-347)
- Export `importData(userId, data, options)` function

- [ ] **Step 13: Slim the cron and import routes**

Both routes become thin handlers that validate, check auth, and call the service.

- [ ] **Step 14: Run existing tests for reminders and import**

Run: `npx vitest run tests/api/reminders.test.ts tests/api/user-import.test.ts`
Expected: PASS (if these test files exist — search for relevant test files first)

- [ ] **Step 15: Commit services extraction**

```bash
git add lib/services/reminders.ts lib/services/import.ts app/api/cron/send-reminders/route.ts app/api/user/import/route.ts
git commit -m "refactor: extract reminders and import services from routes"
```

---

## Chunk 6: vCard Consolidation (Tier 2, Task 6)

### Task 6: vCard Consolidation

**Files:**
- Create: `lib/carddav/vcard-export.ts` (absorbs lib/vcard.ts export functions)
- Create: `lib/carddav/vcard-import.ts` (absorbs person-from-vcard.ts import functions)
- Create: `lib/carddav/vcard-field-map.ts` (shared mapping table)
- Delete: `lib/vcard.ts` (after migration)
- Delete: `lib/vcard-helpers.ts` (after migration — client utils move to vcard-export.ts or stay as utils)
- Modify: `lib/carddav/person-from-vcard.ts` → rename/replace with vcard-import.ts
- Modify: `lib/carddav/sync.ts:2,8` (update imports)
- Modify: `lib/carddav/auto-export.ts:4` (update imports)
- Independent of: Tasks 4-5

**Context:** Three files handle vCard transformation with overlapping logic. We consolidate into two clear files (export/import) plus a shared field mapping table. The raw parser (`vcard-parser.ts`, 798 lines) stays untouched. `vcard-helpers.ts` contains client-side utilities (download, base64, clipboard) that are separate concerns — they move to `vcard-export.ts` or stay as a client utils file.

- [ ] **Step 1: Create the shared field mapping table**

```typescript
// lib/carddav/vcard-field-map.ts
export interface VCardFieldMapping {
  vcard: string;       // vCard property name (TEL, EMAIL, etc.)
  person: string;      // Person model field name (phoneNumbers, emails, etc.)
  toVCard: (items: unknown[]) => string[];   // Person → vCard lines
  fromVCard: (props: unknown[]) => unknown[]; // vCard properties → Person items
}

export const VCARD_FIELD_MAP: VCardFieldMapping[] = [
  {
    vcard: 'TEL',
    person: 'phoneNumbers',
    toVCard: (phones) => phones.map((p) => /* format TEL line */),
    fromVCard: (props) => props.map((p) => /* parse to PersonPhone */),
  },
  // EMAIL, ADR, URL, IMPP, GEO, X-* fields
  // Extract the exact transformations from lib/vcard.ts and lib/carddav/person-from-vcard.ts
];
```

**Important:** Read both `lib/vcard.ts:36-285` (personToVCard) and `lib/carddav/person-from-vcard.ts:27-125` (buildMultiValueCreateData/buildScalarPersonData) to extract the exact transformation logic for each field.

- [ ] **Step 2: Create `vcard-export.ts`**

Absorbs from `lib/vcard.ts`:
- `personToVCard()` (lines 36-285) — refactored to use VCARD_FIELD_MAP for multi-value fields
- `peopleToVCard()` (lines 290-297)
- `formatVCardV3Date()`, `foldLine()`, `buildV3Property()`, `escapeVCardText()`, `addPhotoToVCard()`
- `VCardOptions` type

Absorbs from `lib/vcard-helpers.ts` — server-safe functions only:
- `fetchPhotoAsBase64()`, `addPhotoToVCardFromUrl()` (these use fetch, OK for server)

Client-side browser utilities stay in a new `lib/vcard-client-utils.ts`:
- `generateVcfFilename()`, `generateBulkVcfFilename()`, `downloadVcf()`, `exportPeopleWithProgress()`, `copyToClipboard()`, `estimateVcfSize()`

- [ ] **Step 3: Create `vcard-import.ts`**

Absorbs from `lib/carddav/person-from-vcard.ts`:
- `createPersonFromVCardData()`, `restorePersonFromVCardData()`, `updatePersonFromVCard()`, `updatePersonFromVCardInTransaction()`, `savePhotoForPerson()`
- Private helpers: `buildMultiValueCreateData()`, `buildMultiValueUpdateData()`, `buildScalarPersonData()`
- Refactored to use VCARD_FIELD_MAP for multi-value field creation

Absorbs from `lib/vcard.ts`:
- `vCardToPerson()` (lines 303-305) — if it delegates to the parser, keep delegation

- [ ] **Step 4: Update all import paths**

**Complete list of files that import from the three source files:**

**From `@/lib/vcard` (personToVCard, vCardToPerson, addPhotoToVCard, etc.):**
- `lib/carddav/sync.ts:2` → change to `@/lib/carddav/vcard-export`
- `lib/carddav/auto-export.ts:4` → change to `@/lib/carddav/vcard-export`
- `lib/carddav/discover.ts` → change `vCardToPerson` to `@/lib/carddav/vcard-import`
- `components/ImportContactsList.tsx` → change `vCardToPerson` to `@/lib/carddav/vcard-import`
- `components/PersonActionsMenu.tsx` → change `personToVCard` to `@/lib/carddav/vcard-export`
- `components/PersonVCardRawView.tsx` → change `personToVCard` to `@/lib/carddav/vcard-export`
- `components/AccountManagement.tsx` → change `personToVCard` to `@/lib/carddav/vcard-export`
- `app/api/carddav/export-bulk/route.ts` → change to `@/lib/carddav/vcard-export`
- `app/api/carddav/import/route.ts` → change to `@/lib/carddav/vcard-import`
- `app/api/vcard/import/route.ts` → change to `@/lib/carddav/vcard-import`
- `app/api/vcard/upload/route.ts` → change to `@/lib/carddav/vcard-import`

**From `@/lib/vcard-helpers` (downloadVcf, copyToClipboard, etc.):**
These are **client-side browser utilities** (DOM APIs, clipboard, downloads). They should NOT move into `lib/carddav/` — keep them as `lib/vcard-client-utils.ts`:
- `components/PersonActionsMenu.tsx` → change to `@/lib/vcard-client-utils`
- `components/PersonVCardRawView.tsx` → change to `@/lib/vcard-client-utils`
- `components/AccountManagement.tsx` → change to `@/lib/vcard-client-utils`

**From `./person-from-vcard` (updatePersonFromVCard, createPersonFromVCardData, etc.):**
- `lib/carddav/sync.ts:8` → change to `./vcard-import`
- `app/api/carddav/import/route.ts` → change to `@/lib/carddav/vcard-import`
- `app/api/carddav/conflicts/[id]/resolve/route.ts` → change to `@/lib/carddav/vcard-import`

**Test files with mocks that reference old paths (MUST update `vi.mock()` paths):**
- `tests/lib/carddav/person-from-vcard.test.ts` → update mock path
- `tests/lib/carddav/vcard.test.ts` → update mock path
- `tests/lib/vcard-second-lastname.test.ts` → update mock path
- `tests/lib/vcard-v3-compliance.test.ts` → update mock path
- `tests/app/api/carddav/import-relationship.test.ts` → update mock path
- `tests/app/api/carddav/import-duplicate-uid.test.ts` → update mock path
- `tests/api/vcard-import-limits.test.ts` → update mock path
- `tests/api/carddav-import-limits.test.ts` → update mock path

Verify with: `grep -r "from.*vcard\|from.*person-from-vcard" --include="*.ts" --include="*.tsx"`

- [ ] **Step 5: Run ALL existing vCard and CardDAV tests**

Run: `npx vitest run tests/lib/carddav/ tests/lib/vcard*.test.ts tests/api/vcard*.test.ts tests/api/carddav*.test.ts tests/app/api/carddav/`
Expected: PASS — all behavior preserved

- [ ] **Step 6: Delete old files**

Remove `lib/vcard.ts`, `lib/vcard-helpers.ts`, and `lib/carddav/person-from-vcard.ts`.
Create `lib/vcard-client-utils.ts` with the client-side browser utilities extracted from `lib/vcard-helpers.ts`.

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/carddav/vcard-export.ts lib/carddav/vcard-import.ts lib/carddav/vcard-field-map.ts lib/vcard-client-utils.ts
git add -u  # stage deletions and import path updates
git commit -m "refactor: consolidate vCard transformation into export/import modules with shared field map"
```

---

## Chunk 7: OpenAPI Spec Splitting (Tier 3, Task 7)

### Task 7: OpenAPI Spec Splitting

**Files:**
- Create: `lib/openapi/index.ts`
- Create: `lib/openapi/schemas.ts`
- Create: `lib/openapi/helpers.ts`
- Create: `lib/openapi/people.ts`
- Create: `lib/openapi/groups.ts`
- Create: `lib/openapi/relationships.ts`
- Create: `lib/openapi/auth.ts`
- Create: `lib/openapi/carddav.ts`
- Create: `lib/openapi/billing.ts`
- Create: `lib/openapi/user.ts`
- Create: `lib/openapi/dashboard.ts`
- Delete: `lib/openapi.ts` (after migration)
- Reference: `tests/api/openapi-spec.test.ts` (must continue to pass)
- Independent of all other tasks

**Context:** The 2,596-line monolithic `lib/openapi.ts` is split into domain modules. Each exports a `*Paths()` function returning its path definitions. The composer in `index.ts` merges them. The existing test stays unchanged. This is a single PR.

- [ ] **Step 1: Extract helpers first**

Read `lib/openapi.ts:2506-2596` for the helper functions. Create:

```typescript
// lib/openapi/helpers.ts
// Move: zodBody(), jsonBody(), pathParam(), jsonResponse(), resp(),
//       ref400(), ref401(), ref404(), refMessage(), refSuccess(), refGraph()
// These are used by all domain modules.
```

- [ ] **Step 2: Extract schemas**

Read `lib/openapi.ts:69-478` for the component schemas. Create:

```typescript
// lib/openapi/schemas.ts
export function sharedSchemas() {
  return {
    // Error, ValidationError, Message, Success (lines 84-121)
    // Person, Group, Relationship, etc. (lines 122-476)
  };
}
```

- [ ] **Step 3: Extract each domain module**

Using the line ranges from the exploration:

| Module | Subsections | Export function |
|--------|------------|----------------|
| `auth.ts` | Auth (registration, login, password reset, email verification) | `authPaths()` |
| `people.ts` | People CRUD + Duplicates/Merge + Important Dates + Photos | `peoplePaths()` |
| `groups.ts` | Groups + Deleted Items (soft-delete restore) | `groupsPaths()` |
| `relationships.ts` | Relationships + Relationship Types | `relationshipsPaths()` |
| `dashboard.ts` | Dashboard stats + graph | `dashboardPaths()` |
| `user.ts` | User settings + profile + export/import | `userPaths()` |
| `billing.ts` | Subscription management (SaaS) | `billingPaths()` |
| `carddav.ts` | CardDAV connection/sync/import/export/conflicts + vCard file import/upload | `carddavPaths()` |
| `system.ts` | Health checks, OpenAPI docs endpoint, cron jobs | `systemPaths()` |

Read `lib/openapi.ts` section comments to find exact boundaries. The `OpenAPISpec` interface and `packageJson` import go in `index.ts`.

- [ ] **Step 4: Create the composer**

```typescript
// lib/openapi/index.ts
import { sharedSchemas } from './schemas';
import { authPaths } from './auth';
import { peoplePaths } from './people';
import { groupsPaths } from './groups';
import { relationshipsPaths } from './relationships';
import { dashboardPaths } from './dashboard';
import { userPaths } from './user';
import { billingPaths } from './billing';
import { carddavPaths } from './carddav';

export function generateOpenAPISpec() {
  return {
    openapi: '3.1.0',
    info: { /* from lib/openapi.ts:32-68 */ },
    servers: [/* ... */],
    tags: [/* ... */],
    paths: {
      ...authPaths(),
      ...peoplePaths(),
      ...groupsPaths(),
      ...relationshipsPaths(),
      ...dashboardPaths(),
      ...userPaths(),
      ...billingPaths(),
      ...carddavPaths(),
    },
    components: {
      securitySchemes: { /* ... */ },
      schemas: sharedSchemas(),
    },
  };
}
```

- [ ] **Step 5: Update import in test and any other consumers**

```typescript
// tests/api/openapi-spec.test.ts — update import:
import { generateOpenAPISpec } from '@/lib/openapi/index';
// (or just '@/lib/openapi' if index.ts is the entry)
```

Search for all imports of `@/lib/openapi` and update.

- [ ] **Step 6: Run the OpenAPI test**

Run: `npx vitest run tests/api/openapi-spec.test.ts`
Expected: PASS — output is identical

- [ ] **Step 7: Delete old `lib/openapi.ts`**

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 9: Commit**

Note: Since the new directory `lib/openapi/` has the same base name as the old file `lib/openapi.ts`, imports like `@/lib/openapi` will automatically resolve to `lib/openapi/index.ts` once the old file is deleted. The `app/api/openapi.json/route.ts` import should work without changes.

```bash
git add lib/openapi/
git add -u  # stage deletion of lib/openapi.ts and any import path updates
git commit -m "refactor: split OpenAPI spec into domain modules"
```

---

## Chunk 8: Component Test Coverage (Tier 3, Task 8)

### Task 8: Component Test Coverage

**Files:**
- Create: `tests/components/GroupForm.test.tsx`
- Create: `tests/components/PersonActionsMenu.test.tsx`
- Create: `tests/components/PersonCompare.test.tsx`
- Create: `tests/components/PeopleListClient.test.tsx`
- Reference: Existing test patterns in `tests/components/`
- Independent — can start after Tier 2

**Context:** Only 21% of components have tests. New abstractions (FieldManager, PersonForm sections) get tests as part of their implementation in Tasks 3-4. This task covers critical existing components that remain untested. Use behavior-focused testing with Vitest + React Testing Library.

- [ ] **Step 1: Write tests for GroupForm**

Read `components/GroupForm.tsx` first. Test:
- Renders create form with empty fields
- Renders edit form with existing group data
- Validates required fields (name)
- Calls onSubmit with form data
- Handles color picker selection

```typescript
// tests/components/GroupForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
// ... render with NextIntlClientProvider
```

- [ ] **Step 2: Run GroupForm tests**

Run: `npx vitest run tests/components/GroupForm.test.tsx`
Expected: PASS

- [ ] **Step 3: Write tests for PersonActionsMenu**

Read `components/PersonActionsMenu.tsx` first. Test the most important actions:
- Menu opens on click
- Delete action shows confirmation
- Merge action is available
- Export to vCard action

- [ ] **Step 4: Run PersonActionsMenu tests**

Run: `npx vitest run tests/components/PersonActionsMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Write tests for PersonCompare**

Read `components/PersonCompare.tsx` first. Test:
- Renders side-by-side comparison
- Field selection (keep left/right) works
- Merge button calls handler with selected fields

- [ ] **Step 6: Run PersonCompare tests**

Run: `npx vitest run tests/components/PersonCompare.test.tsx`
Expected: PASS

- [ ] **Step 7: Write tests for PeopleListClient**

Read `components/PeopleListClient.tsx` first. Test:
- Renders list of people
- Search filters results
- Sort changes order
- Bulk action selection works

- [ ] **Step 8: Run PeopleListClient tests**

Run: `npx vitest run tests/components/PeopleListClient.test.tsx`
Expected: PASS

- [ ] **Step 9: Run full test suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add tests/components/GroupForm.test.tsx tests/components/PersonActionsMenu.test.tsx tests/components/PersonCompare.test.tsx tests/components/PeopleListClient.test.tsx
git commit -m "test: add component tests for GroupForm, PersonActionsMenu, PersonCompare, PeopleListClient"
```
