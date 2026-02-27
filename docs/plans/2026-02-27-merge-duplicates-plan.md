# Merge Duplicate Contacts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add duplicate detection and contact merging to Nametag so users can find and merge duplicate contacts.

**Architecture:** Server-side Levenshtein similarity on name fields for detection. A merge API endpoint runs a Prisma transaction to transfer all data from the secondary contact to the primary, then soft-deletes the secondary. The UI uses a new general-purpose `PersonCompare` component for the side-by-side merge screen.

**Tech Stack:** Next.js API routes, Prisma transactions, React client components, next-intl for i18n.

---

### Task 1: Levenshtein Similarity Utility

**Files:**
- Create: `lib/duplicate-detection.ts`

**Step 1: Create the Levenshtein utility**

```typescript
/**
 * Compute Levenshtein distance between two strings.
 * Returns edit distance (number of insertions, deletions, substitutions).
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Returns similarity score between 0 and 1.
 * 1 = identical, 0 = completely different.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.75;

export interface DuplicateCandidate {
  personId: string;
  name: string;
  surname: string | null;
  similarity: number;
}

/**
 * Build a full name string for comparison (lowercase, trimmed).
 */
function buildComparisonName(name: string, surname: string | null): string {
  return [name, surname].filter(Boolean).join(' ').toLowerCase().trim();
}

/**
 * Find duplicate candidates for a given person from a list of all people.
 * Returns candidates sorted by similarity descending, above the threshold.
 */
export function findDuplicates(
  targetName: string,
  targetSurname: string | null,
  people: Array<{ id: string; name: string; surname: string | null }>,
  targetId?: string
): DuplicateCandidate[] {
  const targetFull = buildComparisonName(targetName, targetSurname);
  if (!targetFull) return [];

  const candidates: DuplicateCandidate[] = [];

  for (const person of people) {
    if (person.id === targetId) continue;
    const personFull = buildComparisonName(person.name, person.surname);
    if (!personFull) continue;

    const similarity = stringSimilarity(targetFull, personFull);
    if (similarity >= SIMILARITY_THRESHOLD) {
      candidates.push({
        personId: person.id,
        name: person.name,
        surname: person.surname,
        similarity,
      });
    }
  }

  return candidates.sort((a, b) => b.similarity - a.similarity);
}

export interface DuplicateGroup {
  people: Array<{ id: string; name: string; surname: string | null }>;
  similarity: number;
}

/**
 * Find all duplicate groups across all people.
 * Uses union-find to group contacts that are similar to each other.
 */
export function findAllDuplicateGroups(
  people: Array<{ id: string; name: string; surname: string | null }>
): DuplicateGroup[] {
  // Map person id -> group representative id
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  // Track best similarity for each group
  const groupSimilarity = new Map<string, number>();

  for (let i = 0; i < people.length; i++) {
    const a = people[i];
    const aFull = buildComparisonName(a.name, a.surname);
    if (!aFull) continue;

    for (let j = i + 1; j < people.length; j++) {
      const b = people[j];
      const bFull = buildComparisonName(b.name, b.surname);
      if (!bFull) continue;

      const similarity = stringSimilarity(aFull, bFull);
      if (similarity >= SIMILARITY_THRESHOLD) {
        union(a.id, b.id);
        const root = find(a.id);
        const current = groupSimilarity.get(root) ?? 0;
        if (similarity > current) groupSimilarity.set(root, similarity);
      }
    }
  }

  // Collect groups
  const groups = new Map<string, Array<{ id: string; name: string; surname: string | null }>>();
  for (const person of people) {
    const root = find(person.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(person);
  }

  // Filter to groups with 2+ members
  const result: DuplicateGroup[] = [];
  for (const [root, members] of groups) {
    if (members.length >= 2) {
      result.push({
        people: members,
        similarity: groupSimilarity.get(root) ?? 0,
      });
    }
  }

  return result.sort((a, b) => b.similarity - a.similarity);
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit lib/duplicate-detection.ts` or `npm run build` (partial check)

**Step 3: Commit**

```bash
git add lib/duplicate-detection.ts
git commit -m "feat: add Levenshtein-based duplicate detection utility"
```

---

### Task 2: Merge Validation Schema

**Files:**
- Modify: `lib/validations.ts` (add merge schema near line 222, after `bulkActionSchema`)

**Step 1: Add merge schema**

Add after `bulkActionSchema` (around line 222):

```typescript
// ============================================
// Merge schemas
// ============================================

const scalarOverrideFields = z.object({
  name: z.string().optional(),
  surname: z.string().nullable().optional(),
  middleName: z.string().nullable().optional(),
  secondLastName: z.string().nullable().optional(),
  nickname: z.string().nullable().optional(),
  prefix: z.string().nullable().optional(),
  suffix: z.string().nullable().optional(),
  organization: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  anniversary: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  relationshipToUserId: z.string().nullable().optional(),
}).strict();

export const mergePersonSchema = z.object({
  primaryId: cuidSchema,
  secondaryId: cuidSchema,
  fieldOverrides: scalarOverrideFields.optional(),
}).refine(data => data.primaryId !== data.secondaryId, {
  message: 'Cannot merge a person with themselves',
});
```

**Step 2: Verify it compiles**

Run: `npm run build` (partial)

**Step 3: Commit**

```bash
git add lib/validations.ts
git commit -m "feat: add merge person validation schema"
```

---

### Task 3: Per-Person Duplicates API

**Files:**
- Create: `app/api/people/[id]/duplicates/route.ts`

**Step 1: Create the duplicates endpoint**

```typescript
import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { findDuplicates } from '@/lib/duplicate-detection';

// GET /api/people/[id]/duplicates - Find potential duplicates for a person
export const GET = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context!.params;

    // Get the target person
    const target = await prisma.person.findUnique({
      where: { id, userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, surname: true },
    });

    if (!target) {
      return apiResponse.notFound('Person not found');
    }

    // Get all other people for this user
    const allPeople = await prisma.person.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, surname: true },
    });

    const candidates = findDuplicates(target.name, target.surname, allPeople, target.id);

    return apiResponse.ok({ duplicates: candidates });
  } catch (error) {
    return handleApiError(error, 'people-duplicates');
  }
});
```

**Step 2: Test manually**

Run: `npm run dev`, then `curl http://localhost:3000/api/people/<some-id>/duplicates` (with auth cookie)

**Step 3: Commit**

```bash
git add app/api/people/[id]/duplicates/route.ts
git commit -m "feat: add per-person duplicate detection API endpoint"
```

---

### Task 4: Global Duplicates API

**Files:**
- Create: `app/api/people/duplicates/route.ts`

**Step 1: Create the global duplicates endpoint**

```typescript
import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { findAllDuplicateGroups } from '@/lib/duplicate-detection';

// GET /api/people/duplicates - Find all duplicate groups across all contacts
export const GET = withAuth(async (_request, session) => {
  try {
    const allPeople = await prisma.person.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, surname: true },
    });

    const groups = findAllDuplicateGroups(allPeople);

    return apiResponse.ok({ groups });
  } catch (error) {
    return handleApiError(error, 'people-duplicates-all');
  }
});
```

**Step 2: Commit**

```bash
git add app/api/people/duplicates/route.ts
git commit -m "feat: add global duplicate detection API endpoint"
```

---

### Task 5: Merge API Endpoint

**Files:**
- Create: `app/api/people/merge/route.ts`

This is the most complex task. The merge endpoint runs a transaction that:
1. Applies scalar field overrides to the primary
2. Re-parents multi-value fields from secondary to primary (with deduplication)
3. Transfers groups
4. Transfers relationships
5. Handles CardDAV mapping
6. Soft-deletes the secondary

**Step 1: Create the merge endpoint**

```typescript
import { prisma } from '@/lib/prisma';
import { mergePersonSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { deleteFromCardDav } from '@/lib/carddav/delete-contact';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('merge');

// POST /api/people/merge - Merge two contacts
export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validated = validateRequest(mergePersonSchema, body);
    const { primaryId, secondaryId, fieldOverrides } = validated;

    // Fetch both people with all relations
    const [primary, secondary] = await Promise.all([
      prisma.person.findUnique({
        where: { id: primaryId, userId: session.user.id, deletedAt: null },
        include: {
          groups: true,
          relationshipsFrom: true,
          relationshipsTo: true,
          phoneNumbers: true,
          emails: true,
          addresses: true,
          urls: true,
          imHandles: true,
          locations: true,
          customFields: true,
          importantDates: true,
          cardDavMapping: { include: { connection: true } },
        },
      }),
      prisma.person.findUnique({
        where: { id: secondaryId, userId: session.user.id, deletedAt: null },
        include: {
          groups: true,
          relationshipsFrom: true,
          relationshipsTo: true,
          phoneNumbers: true,
          emails: true,
          addresses: true,
          urls: true,
          imHandles: true,
          locations: true,
          customFields: true,
          importantDates: true,
          cardDavMapping: { include: { connection: true } },
        },
      }),
    ]);

    if (!primary) return apiResponse.notFound('Primary person not found');
    if (!secondary) return apiResponse.notFound('Secondary person not found');

    // Build scalar update data from fieldOverrides
    const scalarUpdate: Record<string, unknown> = {};
    if (fieldOverrides) {
      for (const [key, value] of Object.entries(fieldOverrides)) {
        if (key === 'relationshipToUserId') {
          if (value) {
            scalarUpdate.relationshipToUser = { connect: { id: value } };
          } else {
            scalarUpdate.relationshipToUser = { disconnect: true };
          }
        } else {
          scalarUpdate[key] = value;
        }
      }
    }

    // Identify groups to transfer (secondary's groups that primary doesn't have)
    const primaryGroupIds = new Set(primary.groups.map(g => g.groupId));
    const groupsToAdd = secondary.groups.filter(g => !primaryGroupIds.has(g.groupId));

    // Identify relationships to transfer
    // relationshipsFrom: secondary -> other person. Skip if primary already has one to the same person.
    const primaryFromTargets = new Set(primary.relationshipsFrom.map(r => r.relatedPersonId));
    const relsFromToTransfer = secondary.relationshipsFrom.filter(
      r => r.relatedPersonId !== primaryId && !primaryFromTargets.has(r.relatedPersonId)
    );

    // relationshipsTo: other person -> secondary. Skip if primary already has one from the same person.
    const primaryToSources = new Set(primary.relationshipsTo.map(r => r.personId));
    const relsToToTransfer = secondary.relationshipsTo.filter(
      r => r.personId !== primaryId && !primaryToSources.has(r.personId)
    );

    // Identify duplicate multi-value entries to avoid after union
    const primaryPhones = new Set(primary.phoneNumbers.map(p => p.number));
    const primaryEmails = new Set(primary.emails.map(e => e.email));

    const phonesToTransfer = secondary.phoneNumbers.filter(p => !primaryPhones.has(p.number));
    const emailsToTransfer = secondary.emails.filter(e => !primaryEmails.has(e.email));

    // For other multi-value fields, transfer all (less likely to have exact dupes)
    // Run the transaction
    await prisma.$transaction(async (tx) => {
      // 1. Update primary with scalar overrides
      if (Object.keys(scalarUpdate).length > 0) {
        await tx.person.update({
          where: { id: primaryId },
          data: scalarUpdate,
        });
      }

      // 2. Transfer multi-value fields by re-parenting
      if (phonesToTransfer.length > 0) {
        await tx.personPhone.updateMany({
          where: { id: { in: phonesToTransfer.map(p => p.id) } },
          data: { personId: primaryId },
        });
      }
      if (emailsToTransfer.length > 0) {
        await tx.personEmail.updateMany({
          where: { id: { in: emailsToTransfer.map(e => e.id) } },
          data: { personId: primaryId },
        });
      }
      // Addresses, URLs, IMs, locations, custom fields, important dates: transfer all
      await tx.personAddress.updateMany({
        where: { personId: secondaryId },
        data: { personId: primaryId },
      });
      await tx.personUrl.updateMany({
        where: { personId: secondaryId },
        data: { personId: primaryId },
      });
      await tx.personIM.updateMany({
        where: { personId: secondaryId },
        data: { personId: primaryId },
      });
      await tx.personLocation.updateMany({
        where: { personId: secondaryId },
        data: { personId: primaryId },
      });
      await tx.personCustomField.updateMany({
        where: { personId: secondaryId },
        data: { personId: primaryId },
      });
      await tx.importantDate.updateMany({
        where: { personId: secondaryId },
        data: { personId: primaryId },
      });

      // Delete duplicate phones/emails that weren't transferred
      const duplicatePhoneIds = secondary.phoneNumbers
        .filter(p => primaryPhones.has(p.number))
        .map(p => p.id);
      const duplicateEmailIds = secondary.emails
        .filter(e => primaryEmails.has(e.email))
        .map(e => e.id);
      if (duplicatePhoneIds.length > 0) {
        await tx.personPhone.deleteMany({ where: { id: { in: duplicatePhoneIds } } });
      }
      if (duplicateEmailIds.length > 0) {
        await tx.personEmail.deleteMany({ where: { id: { in: duplicateEmailIds } } });
      }

      // 3. Transfer groups
      for (const group of groupsToAdd) {
        await tx.personGroup.create({
          data: { personId: primaryId, groupId: group.groupId },
        });
      }

      // 4. Transfer relationships
      for (const rel of relsFromToTransfer) {
        await tx.relationship.update({
          where: { id: rel.id },
          data: { personId: primaryId },
        });
      }
      for (const rel of relsToToTransfer) {
        await tx.relationship.update({
          where: { id: rel.id },
          data: { relatedPersonId: primaryId },
        });
      }

      // Delete remaining secondary relationships (duplicates or self-referential)
      await tx.relationship.deleteMany({
        where: {
          OR: [
            { personId: secondaryId },
            { relatedPersonId: secondaryId },
          ],
        },
      });

      // Delete secondary's remaining group memberships
      await tx.personGroup.deleteMany({
        where: { personId: secondaryId },
      });

      // 5. Handle CardDAV mapping
      if (secondary.cardDavMapping) {
        await tx.cardDavMapping.delete({
          where: { id: secondary.cardDavMapping.id },
        });
      }

      // 6. Soft-delete the secondary
      await tx.person.update({
        where: { id: secondaryId },
        data: { deletedAt: new Date() },
      });
    });

    // After transaction: try to delete secondary's vCard from server (non-blocking)
    if (secondary.cardDavMapping) {
      deleteFromCardDav(secondaryId).catch((err) => {
        log.warn({ err, secondaryId }, 'Failed to delete secondary vCard from CardDAV server');
      });
    }

    log.info({ primaryId, secondaryId }, 'Successfully merged contacts');
    return apiResponse.ok({ mergedInto: primaryId });
  } catch (error) {
    return handleApiError(error, 'people-merge');
  }
});
```

**Step 2: Verify it compiles**

Run: `npm run build`

**Step 3: Commit**

```bash
git add app/api/people/merge/route.ts
git commit -m "feat: add merge contacts API endpoint with transactional data transfer"
```

---

### Task 6: Translations

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/es-ES.json`
- Modify: `locales/de-DE.json`
- Modify: `locales/ja-JP.json`
- Modify: `locales/nb-NO.json`

**Step 1: Add translation keys to all five locale files**

Add under the `people` namespace in each locale file. The keys to add:

```json
"duplicates": {
  "title": "Duplicate Contacts",
  "findDuplicates": "Find Duplicates",
  "noDuplicates": "No duplicate contacts found.",
  "similarity": "{score}% match",
  "merge": "Merge",
  "scanAll": "Scan All Contacts",
  "duplicateGroups": "{count, plural, one {# group} other {# groups}} of potential duplicates found"
},
"merge": {
  "title": "Merge Contacts",
  "selectPrimary": "Select which contact to keep as the primary:",
  "primary": "Primary (keeps)",
  "secondary": "Will be merged in",
  "conflictingFields": "These fields have different values. Choose which to keep:",
  "multiValueNote": "{count} {field} will be combined",
  "phones": "phones",
  "emails": "emails",
  "addresses": "addresses",
  "urls": "URLs",
  "imHandles": "IM handles",
  "locations": "locations",
  "customFields": "custom fields",
  "importantDates": "important dates",
  "groups": "groups",
  "relationships": "relationships",
  "confirmMerge": "Confirm Merge",
  "cancel": "Cancel",
  "merging": "Merging contacts...",
  "success": "Contacts merged successfully",
  "error": "Failed to merge contacts",
  "summary": "Summary",
  "willTransfer": "Will be transferred to the primary contact:",
  "willCombine": "Will be combined:",
  "willDelete": "The secondary contact will be deleted after merging."
}
```

Translate these for each language:
- `es-ES`: Spanish translations
- `de-DE`: German translations
- `ja-JP`: Japanese translations
- `nb-NO`: Norwegian Bokmal translations

**Step 2: Commit**

```bash
git add locales/
git commit -m "feat: add merge/duplicates translations for all five languages"
```

---

### Task 7: DuplicatesList Component

**Files:**
- Create: `components/DuplicatesList.tsx`

**Step 1: Create the component**

This component receives a list of duplicate candidates and renders them with similarity scores and a "Merge" link. Used on both the person detail page and the global duplicates page.

```typescript
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

export interface DuplicateCandidateDisplay {
  personId: string;
  name: string;
  surname: string | null;
  similarity: number;
}

export interface DuplicateGroupDisplay {
  people: Array<{ id: string; name: string; surname: string | null }>;
  similarity: number;
}

interface DuplicatesListProps {
  /** For per-person view: the target person's ID */
  targetPersonId?: string;
  /** For per-person view: list of candidates */
  candidates?: DuplicateCandidateDisplay[];
  /** For global view: list of duplicate groups */
  groups?: DuplicateGroupDisplay[];
}

function formatName(name: string, surname: string | null): string {
  return [name, surname].filter(Boolean).join(' ');
}

export default function DuplicatesList({ targetPersonId, candidates, groups }: DuplicatesListProps) {
  const t = useTranslations('people.duplicates');

  // Per-person mode
  if (candidates !== undefined && targetPersonId) {
    if (candidates.length === 0) {
      return (
        <div className="text-center py-8 text-muted">
          {t('noDuplicates')}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {candidates.map((candidate) => (
          <div
            key={candidate.personId}
            className="flex items-center justify-between p-4 bg-surface border border-border rounded-lg"
          >
            <div>
              <span className="font-medium text-foreground">
                {formatName(candidate.name, candidate.surname)}
              </span>
              <span className="ml-2 text-sm text-muted">
                {t('similarity', { score: Math.round(candidate.similarity * 100) })}
              </span>
            </div>
            <Link
              href={`/people/merge?primary=${targetPersonId}&secondary=${candidate.personId}`}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              {t('merge')}
            </Link>
          </div>
        ))}
      </div>
    );
  }

  // Global mode
  if (groups !== undefined) {
    if (groups.length === 0) {
      return (
        <div className="text-center py-8 text-muted">
          {t('noDuplicates')}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-muted">
          {t('duplicateGroups', { count: groups.length })}
        </p>
        {groups.map((group, index) => (
          <div key={index} className="p-4 bg-surface border border-border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted">
                {t('similarity', { score: Math.round(group.similarity * 100) })}
              </span>
            </div>
            <div className="space-y-2">
              {group.people.map((person, i) =>
                group.people.slice(i + 1).map((other) => (
                  <div key={`${person.id}-${other.id}`} className="flex items-center justify-between">
                    <span className="text-foreground">
                      {formatName(person.name, person.surname)} &amp; {formatName(other.name, other.surname)}
                    </span>
                    <Link
                      href={`/people/merge?primary=${person.id}&secondary=${other.id}`}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
                    >
                      {t('merge')}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
```

**Step 2: Commit**

```bash
git add components/DuplicatesList.tsx
git commit -m "feat: add DuplicatesList component for displaying duplicate candidates"
```

---

### Task 8: PersonCompare Component

**Files:**
- Create: `components/PersonCompare.tsx`

**Step 1: Create the component**

This is the general-purpose side-by-side comparison component used on the merge page. It shows scalar field conflicts with radio pickers and multi-value field summaries.

Reference the field list from `components/ConflictList.tsx:60-73` for scalar fields.
Reference the Person model from `prisma/schema.prisma:53-117` for all fields.

The component should:
- Accept two full Person objects (with multi-value fields included)
- Show a radio toggle at the top to pick which is primary
- For each scalar field where both have different non-empty values, show a radio picker
- For multi-value fields, show counts of items that will be combined
- Expose the selections via a callback: `onSelectionsChange(primaryId, fieldOverrides)`

The full Person type should match what the `GET /api/people/[id]` route returns (see `app/api/people/[id]/route.ts:14-44`).

Use `useTranslations('people.merge')` for labels.

This component is a client component (`'use client'`). Keep it straightforward — radio buttons for primary selection, radio buttons per conflicting field, static text for multi-value summaries.

**Step 2: Commit**

```bash
git add components/PersonCompare.tsx
git commit -m "feat: add PersonCompare component for side-by-side contact comparison"
```

---

### Task 9: Merge Page

**Files:**
- Create: `app/people/merge/page.tsx`

**Step 1: Create the merge page**

This page:
1. Reads `primary` and `secondary` from URL search params
2. Fetches both persons from the API (`GET /api/people/[id]`)
3. Renders `PersonCompare` component
4. Has a "Confirm Merge" button that calls `POST /api/people/merge`
5. On success, redirects to the primary person's detail page
6. Shows loading and error states

This is a client component page. Use `useSearchParams()` to read query params. Use `fetch` for API calls. Use `useRouter` for navigation.

**Step 2: Commit**

```bash
git add app/people/merge/page.tsx
git commit -m "feat: add merge contacts page with side-by-side comparison"
```

---

### Task 10: Global Duplicates Page

**Files:**
- Create: `app/people/duplicates/page.tsx`

**Step 1: Create the global duplicates page**

This page:
1. Calls `GET /api/people/duplicates` on mount
2. Renders `DuplicatesList` in global mode (passing `groups`)
3. Shows loading and empty states
4. Has a page title from translations

This is a client component page.

**Step 2: Commit**

```bash
git add app/people/duplicates/page.tsx
git commit -m "feat: add global duplicates scanner page"
```

---

### Task 11: Add "Find Duplicates" Button to Person Detail Page

**Files:**
- Modify: `app/people/[id]/page.tsx` (around line 325-337, the action buttons div)

**Step 1: Add the button**

In the action buttons section at line 325, add a "Find Duplicates" link button alongside the Edit and Delete buttons. It should link to `/people/duplicates` or trigger an inline duplicate search. Simplest approach: link to `/people/merge` flow by first checking for duplicates.

Add a `Link` to `/people/${person.id}/duplicates-check` or use a client component that calls the API inline. The simplest approach is a `Link` button that goes to a page showing duplicates for this person.

Actually, simplest: add a link that navigates to the global duplicates page with a query param, OR create a small client component `FindDuplicatesButton` that:
1. Calls `GET /api/people/[id]/duplicates` on click
2. Shows results in a dropdown/modal
3. Each result links to the merge page

Create `components/FindDuplicatesButton.tsx` as a client component, then add it to the person detail page at line 325-337.

**Step 2: Commit**

```bash
git add components/FindDuplicatesButton.tsx app/people/[id]/page.tsx
git commit -m "feat: add Find Duplicates button to person detail page"
```

---

### Task 12: Add "Find Duplicates" Button to People List Toolbar

**Files:**
- Modify: `app/people/page.tsx` (around line 142-166, the toolbar div)

**Step 1: Add the button**

Add a `Link` to `/people/duplicates` in the toolbar alongside the "Add Person" button. Style it as a secondary button (not primary color — use a border/outline style to differentiate from "Add Person").

**Step 2: Commit**

```bash
git add app/people/page.tsx
git commit -m "feat: add Find Duplicates button to people list toolbar"
```

---

### Task 13: Build Verification & Final Review

**Step 1: Run full build**

Run: `npm run build`

Ensure zero TypeScript errors and zero build failures.

**Step 2: Manual testing checklist**

1. Navigate to People list — "Find Duplicates" button visible
2. Click it — goes to `/people/duplicates`, shows groups (or empty state)
3. Navigate to a person's detail page — "Find Duplicates" button visible
4. Click it — shows duplicate candidates (or "no duplicates found")
5. Click "Merge" on a candidate — goes to merge page
6. Swap primary/secondary — UI updates
7. Pick field overrides for conflicting fields
8. Click "Confirm Merge" — merge succeeds, redirects to primary contact
9. Verify: secondary contact is gone from people list
10. Verify: primary contact has all the merged data (groups, relationships, phones, emails)
11. Test with no duplicates — empty state shown correctly
12. Test in Spanish (or another language) — all strings translated

**Step 3: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "feat: complete merge duplicate contacts feature"
```
