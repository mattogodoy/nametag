# Custom Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-defined typed custom fields (Text / Number / Boolean / Single-select) to the Person model, with single-value people-list filtering and CardDAV export, while keeping the existing free-form `PersonCustomField` (vCard `X-`) intact.

**Architecture:** Two new Prisma models — `CustomFieldTemplate` (per-user schema) and `PersonCustomFieldValue` (per-person value, single text column parsed by type). Settings UI manages templates; person form renders typed inputs from the user's active templates. CardDAV exports values as `X-NAMETAG-FIELD-<SLUG>` namespaced X-properties. Tier limits gated through the existing `canCreateResource` helper.

**Tech Stack:** Next.js (App Router), TypeScript, Prisma, PostgreSQL, Zod, Vitest, next-intl, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-05-04-custom-fields-design.md`

---

## File map

**New files**
- `lib/customFields/slug.ts` — slug derivation
- `lib/customFields/values.ts` — type-aware parse/format/validate for stored values
- `lib/customFields/serialize.ts` — vCard export helpers
- `lib/openapi/customFields.ts` — OpenAPI paths for the new endpoints
- `app/api/custom-field-templates/route.ts` — list + create
- `app/api/custom-field-templates/[id]/route.ts` — read + update + delete
- `app/api/custom-field-templates/reorder/route.ts` — bulk reorder
- `app/settings/custom-fields/page.tsx` — settings page (server component)
- `components/customFields/CustomFieldTemplateList.tsx` — list with drag/reorder
- `components/customFields/CustomFieldTemplateForm.tsx` — create / edit form
- `components/customFields/CustomFieldsSection.tsx` — person form integration
- `components/customFields/CustomFieldFilter.tsx` — "More filters" dropdown + chip
- `tests/api/custom-field-templates.test.ts` — API coverage
- `tests/api/people-custom-fields.test.ts` — value upsert / diff coverage
- `tests/lib/customFields-slug.test.ts`
- `tests/lib/customFields-values.test.ts`
- `tests/lib/customFields-serialize.test.ts`

**Modified files**
- `prisma/schema.prisma` — new models, enum, `Person.customFieldValues` relation
- `lib/validations.ts` — new Zod schemas
- `lib/billing/constants.ts` — `customFieldTemplates` tier limits
- `lib/billing/subscription.ts` — usage count includes templates
- `lib/openapi/index.ts` — register customFieldsPaths
- `lib/carddav/vcard.ts` — emit / suppress X-NAMETAG-FIELD-* on export
- `app/api/people/route.ts` — accept `customFieldValues` on create
- `app/api/people/[id]/route.ts` — accept `customFieldValues` on update; diff/upsert
- `app/people/page.tsx` — extend `searchParams`, wire `cf` filter param
- `app/people/[id]/page.tsx` — render custom fields section
- `app/people/[id]/edit/page.tsx`, `app/people/new/page.tsx` (or shared form component) — embed `<CustomFieldsSection>`
- `locales/en.json`, `es-ES.json`, `de-DE.json`, `ja-JP.json`, `nb-NO.json`, `zh-CN.json`

---

## Task 1: Prisma schema and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_custom_field_templates/migration.sql` (generated)

- [ ] **Step 1: Add the enum and two models to `prisma/schema.prisma`**

Find the existing `Person` model's `customFields` relation (`customFields PersonCustomField[]`) and add a new line directly below it:

```prisma
  customFieldValues  PersonCustomFieldValue[]
```

At the end of the file (after the last existing model), append:

```prisma
// CustomFieldTemplate - User-defined typed field schema
model CustomFieldTemplate {
  id        String          @id @default(cuid())
  userId    String
  name      String
  slug      String
  type      CustomFieldType
  options   String[]        @default([])
  order     Int             @default(0)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  deletedAt DateTime?

  // Relations
  user   User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  values PersonCustomFieldValue[]

  @@unique([userId, slug])
  @@index([userId, deletedAt])
  @@map("custom_field_templates")
}

enum CustomFieldType {
  TEXT
  NUMBER
  BOOLEAN
  SELECT
}

// PersonCustomFieldValue - Per-person value for a CustomFieldTemplate
model PersonCustomFieldValue {
  id         String   @id @default(cuid())
  personId   String
  templateId String
  value      String   @db.Text
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // Relations
  person   Person              @relation(fields: [personId], references: [id], onDelete: Cascade)
  template CustomFieldTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([personId, templateId])
  @@index([templateId, value])
  @@map("person_custom_field_values")
}
```

Also add `customFieldTemplates CustomFieldTemplate[]` to the `User` model's relations block (keep alphabetical-ish ordering, near `groups`).

- [ ] **Step 2: Generate migration**

Run:

```bash
npx prisma migrate dev --name add_custom_field_templates
```

Expected: prisma reports the migration applied, generates the client.

- [ ] **Step 3: Verify the schema compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors. (Some downstream uses of `customFieldValues` will fail later — for now there should be none yet.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(custom-fields): add CustomFieldTemplate and PersonCustomFieldValue models"
```

---

## Task 2: Slug derivation utility

**Files:**
- Create: `lib/customFields/slug.ts`
- Test: `tests/lib/customFields-slug.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/customFields-slug.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deriveSlug } from '../../lib/customFields/slug';

describe('deriveSlug', () => {
  it('lowercases and dasherizes basic words', () => {
    expect(deriveSlug('Dietary Restriction')).toBe('dietary-restriction');
  });

  it('trims and collapses whitespace', () => {
    expect(deriveSlug('   Has   Pets   ')).toBe('has-pets');
  });

  it('strips diacritics', () => {
    expect(deriveSlug('Préférence')).toBe('preference');
  });

  it('removes punctuation', () => {
    expect(deriveSlug("Person's hobby!?")).toBe('persons-hobby');
  });

  it('keeps numbers', () => {
    expect(deriveSlug('Hobby 1')).toBe('hobby-1');
  });

  it('returns empty string for input with no slug-able chars', () => {
    expect(deriveSlug('???')).toBe('');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tests/lib/customFields-slug.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the slug utility**

Create `lib/customFields/slug.ts`:

```typescript
export function deriveSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run tests/lib/customFields-slug.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/customFields/slug.ts tests/lib/customFields-slug.test.ts
git commit -m "feat(custom-fields): add slug derivation utility"
```

---

## Task 3: Type-aware value parsing and validation

**Files:**
- Create: `lib/customFields/values.ts`
- Test: `tests/lib/customFields-values.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/customFields-values.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateRawValue,
  formatValueForDisplay,
  isEmptyRawValue,
} from '../../lib/customFields/values';

describe('isEmptyRawValue', () => {
  it('treats empty string and whitespace as empty', () => {
    expect(isEmptyRawValue('')).toBe(true);
    expect(isEmptyRawValue('   ')).toBe(true);
  });

  it('treats any non-blank string as non-empty', () => {
    expect(isEmptyRawValue('false')).toBe(false);
    expect(isEmptyRawValue('0')).toBe(false);
  });
});

describe('validateRawValue', () => {
  it('accepts any non-empty string for TEXT', () => {
    expect(validateRawValue('TEXT', 'anything', [])).toEqual({ ok: true });
  });

  it('rejects non-numeric strings for NUMBER', () => {
    expect(validateRawValue('NUMBER', 'abc', [])).toEqual({
      ok: false,
      error: 'not a number',
    });
  });

  it('accepts decimals and negatives for NUMBER', () => {
    expect(validateRawValue('NUMBER', '-3.14', [])).toEqual({ ok: true });
  });

  it('rejects Infinity / NaN for NUMBER', () => {
    expect(validateRawValue('NUMBER', 'Infinity', [])).toEqual({
      ok: false,
      error: 'not a number',
    });
  });

  it('accepts only "true" or "false" for BOOLEAN', () => {
    expect(validateRawValue('BOOLEAN', 'true', [])).toEqual({ ok: true });
    expect(validateRawValue('BOOLEAN', 'false', [])).toEqual({ ok: true });
    expect(validateRawValue('BOOLEAN', 'yes', [])).toEqual({
      ok: false,
      error: 'must be "true" or "false"',
    });
  });

  it('accepts SELECT values that are in the options list', () => {
    expect(validateRawValue('SELECT', 'vegan', ['vegan', 'omnivore'])).toEqual({
      ok: true,
    });
  });

  it('rejects SELECT values not in the options list', () => {
    expect(validateRawValue('SELECT', 'pescatarian', ['vegan', 'omnivore'])).toEqual({
      ok: false,
      error: 'not in options',
    });
  });
});

describe('formatValueForDisplay', () => {
  it('returns text as-is for TEXT', () => {
    expect(formatValueForDisplay('TEXT', 'hello')).toBe('hello');
  });

  it('returns the number string for NUMBER', () => {
    expect(formatValueForDisplay('NUMBER', '42')).toBe('42');
  });

  it('returns "Yes" / "No" for BOOLEAN', () => {
    expect(formatValueForDisplay('BOOLEAN', 'true')).toBe('Yes');
    expect(formatValueForDisplay('BOOLEAN', 'false')).toBe('No');
  });

  it('returns the option string for SELECT', () => {
    expect(formatValueForDisplay('SELECT', 'vegan')).toBe('vegan');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tests/lib/customFields-values.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the value utilities**

Create `lib/customFields/values.ts`:

```typescript
import type { CustomFieldType } from '@prisma/client';

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function isEmptyRawValue(raw: string): boolean {
  return raw.trim() === '';
}

export function validateRawValue(
  type: CustomFieldType,
  raw: string,
  options: string[]
): ValidationResult {
  switch (type) {
    case 'TEXT':
      return { ok: true };
    case 'NUMBER': {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return { ok: false, error: 'not a number' };
      }
      return { ok: true };
    }
    case 'BOOLEAN':
      if (raw === 'true' || raw === 'false') return { ok: true };
      return { ok: false, error: 'must be "true" or "false"' };
    case 'SELECT':
      if (options.includes(raw)) return { ok: true };
      return { ok: false, error: 'not in options' };
  }
}

export function formatValueForDisplay(type: CustomFieldType, raw: string): string {
  switch (type) {
    case 'TEXT':
    case 'NUMBER':
    case 'SELECT':
      return raw;
    case 'BOOLEAN':
      return raw === 'true' ? 'Yes' : 'No';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run tests/lib/customFields-values.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/customFields/values.ts tests/lib/customFields-values.test.ts
git commit -m "feat(custom-fields): add type-aware value validation and display helpers"
```

---

## Task 4: Tier limits

**Files:**
- Modify: `lib/billing/constants.ts`
- Modify: `lib/billing/subscription.ts`

- [ ] **Step 1: Extend `TIER_LIMITS` and `LimitedResource` in `lib/billing/constants.ts`**

Update the `TIER_LIMITS` block to add `maxCustomFieldTemplates`:

```typescript
export const TIER_LIMITS: Record<
  SubscriptionTier,
  {
    maxPeople: number;
    maxGroups: number;
    maxReminders: number;
    maxCustomFieldTemplates: number;
  }
> = {
  FREE: {
    maxPeople: 50,
    maxGroups: 10,
    maxReminders: 5,
    maxCustomFieldTemplates: 1,
  },
  PERSONAL: {
    maxPeople: 1000,
    maxGroups: 500,
    maxReminders: 100,
    maxCustomFieldTemplates: 20,
  },
  PRO: {
    maxPeople: Infinity,
    maxGroups: Infinity,
    maxReminders: Infinity,
    maxCustomFieldTemplates: Infinity,
  },
};
```

Update `LimitedResource`:

```typescript
export type LimitedResource = 'people' | 'groups' | 'reminders' | 'customFieldTemplates';
```

Update `getTierLimit` to add the new case:

```typescript
case 'customFieldTemplates':
  return limits.maxCustomFieldTemplates;
```

Update each tier's `features` array in `TIER_INFO`:

```typescript
// FREE features:
'1 custom field',
// PERSONAL features:
'Up to 20 custom fields',
// PRO features:
'Unlimited custom fields',
```

- [ ] **Step 2: Extend usage counter in `lib/billing/subscription.ts`**

Find the `getUserUsage` function (currently returns `{ people, groups, reminders }`). Add a parallel `customFieldTemplate.count` query and include it in the return.

The Prisma counts run via `Promise.all([...])`. Add this entry to that array:

```typescript
prisma.customFieldTemplate.count({
  where: { userId, deletedAt: null },
}),
```

Update destructuring of the array result to capture the new count, and extend the return:

```typescript
return {
  people: peopleCount,
  groups: groupsCount,
  reminders: importantDateReminders + contactReminders,
  customFieldTemplates: customFieldTemplatesCount,
};
```

The `UserUsage` return type is inferred — TypeScript will pick up the new key.

- [ ] **Step 3: Verify typecheck and existing tests pass**

Run:

```bash
npx tsc --noEmit
npx vitest run tests/api/billing tests/lib
```

Expected: clean typecheck. Existing billing/lib tests still pass.

- [ ] **Step 4: Commit**

```bash
git add lib/billing/constants.ts lib/billing/subscription.ts
git commit -m "feat(custom-fields): tier limits for custom field templates"
```

---

## Task 5: Zod validation schemas

**Files:**
- Modify: `lib/validations.ts`

- [ ] **Step 1: Add custom field schemas to `lib/validations.ts`**

At the end of the file, add a new section:

```typescript
// ============================================
// Custom field schemas
// ============================================

export const customFieldTypeSchema = z.enum(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT']);

const optionSchema = z
  .string()
  .trim()
  .min(1, 'Option must not be empty')
  .max(100, 'Option must be 100 characters or fewer');

export const customFieldTemplateCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(60, 'Name must be 60 characters or fewer'),
    type: customFieldTypeSchema,
    options: z.array(optionSchema).max(50, 'Up to 50 options').optional(),
  })
  .refine(
    (val) => val.type !== 'SELECT' || (val.options && val.options.length > 0),
    { message: 'At least one option is required for single-select fields', path: ['options'] }
  );

export const customFieldTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    options: z.array(optionSchema).max(50).optional(),
  })
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field must be provided',
  });

export const customFieldTemplateReorderSchema = z.object({
  ids: z.array(cuidSchema).min(1).max(200),
});

export const customFieldValueInputSchema = z.object({
  templateId: cuidSchema,
  value: z.string().max(2000),
});

export const customFieldValuesArraySchema = z
  .array(customFieldValueInputSchema)
  .max(200)
  .optional();
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke-test the schemas**

Add quick assertions at the bottom of `tests/lib/customFields-values.test.ts` (we'll co-locate to avoid creating a one-off test file):

```typescript
import {
  customFieldTemplateCreateSchema,
  customFieldTemplateUpdateSchema,
} from '../../lib/validations';

describe('customFieldTemplateCreateSchema', () => {
  it('requires options when type is SELECT', () => {
    const result = customFieldTemplateCreateSchema.safeParse({
      name: 'Diet',
      type: 'SELECT',
    });
    expect(result.success).toBe(false);
  });

  it('accepts SELECT with options', () => {
    const result = customFieldTemplateCreateSchema.safeParse({
      name: 'Diet',
      type: 'SELECT',
      options: ['vegan'],
    });
    expect(result.success).toBe(true);
  });

  it('accepts non-SELECT types without options', () => {
    const result = customFieldTemplateCreateSchema.safeParse({
      name: 'Has pets',
      type: 'BOOLEAN',
    });
    expect(result.success).toBe(true);
  });
});

describe('customFieldTemplateUpdateSchema', () => {
  it('rejects empty objects', () => {
    expect(customFieldTemplateUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('accepts partial updates', () => {
    expect(customFieldTemplateUpdateSchema.safeParse({ name: 'New' }).success).toBe(true);
  });
});
```

Run:

```bash
npx vitest run tests/lib/customFields-values.test.ts
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/validations.ts tests/lib/customFields-values.test.ts
git commit -m "feat(custom-fields): add zod validation schemas"
```

---

## Task 6: API — list / create / read / update / delete

**Files:**
- Create: `app/api/custom-field-templates/route.ts`
- Create: `app/api/custom-field-templates/[id]/route.ts`
- Create: `tests/api/custom-field-templates.test.ts`

- [ ] **Step 1: Write the failing API tests**

Create `tests/api/custom-field-templates.test.ts`. Use the same testing conventions as `tests/api/groups.test.ts` (read it first if unsure). The minimal coverage:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listGET, POST as listPOST } from '../../app/api/custom-field-templates/route';
import {
  GET as singleGET,
  PUT as singlePUT,
  DELETE as singleDELETE,
} from '../../app/api/custom-field-templates/[id]/route';
import { prisma } from '../../lib/prisma';
import { createTestSession, makeRequest } from './_helpers'; // or whatever the project uses

describe('Custom field templates API', () => {
  let userId: string;

  beforeEach(async () => {
    // Use the project's test fixture creator (see tests/api/groups.test.ts for a pattern)
    userId = await /* create user, return id */;
  });

  it('lists active templates only', async () => {
    await prisma.customFieldTemplate.createMany({
      data: [
        { userId, name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan'] },
        { userId, name: 'Pet', slug: 'pet', type: 'TEXT', deletedAt: new Date() },
      ],
    });
    const res = await listGET(makeRequest('GET', '/api/custom-field-templates', {}, userId));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].slug).toBe('diet');
  });

  it('creates a template and derives slug', async () => {
    const res = await listPOST(makeRequest('POST', '/api/custom-field-templates', {
      name: 'Dietary Restriction', type: 'SELECT', options: ['vegan'],
    }, userId));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.template.slug).toBe('dietary-restriction');
  });

  it('rejects creation when over tier limit (SaaS mode)', async () => {
    // Set SAAS_MODE = true in env, attach FREE subscription, pre-insert 1 template
    // Expect 403 with limit message
    // (Mirror the pattern in tests/api/import-limits.test.ts)
  });

  it('returns 409 on duplicate slug', async () => {
    await prisma.customFieldTemplate.create({
      data: { userId, name: 'Diet', slug: 'diet', type: 'TEXT' },
    });
    const res = await listPOST(makeRequest('POST', '/api/custom-field-templates', {
      name: 'Diet', type: 'TEXT',
    }, userId));
    expect(res.status).toBe(409);
  });

  it('updates name without changing slug', async () => {
    const t = await prisma.customFieldTemplate.create({
      data: { userId, name: 'Diet', slug: 'diet', type: 'TEXT' },
    });
    const res = await singlePUT(
      makeRequest('PUT', `/api/custom-field-templates/${t.id}`, { name: 'Renamed' }, userId),
      { params: Promise.resolve({ id: t.id }) }
    );
    expect(res.status).toBe(200);
    const fresh = await prisma.customFieldTemplate.findUnique({ where: { id: t.id } });
    expect(fresh?.name).toBe('Renamed');
    expect(fresh?.slug).toBe('diet');
  });

  it('rejects type changes on update', async () => {
    const t = await prisma.customFieldTemplate.create({
      data: { userId, name: 'Diet', slug: 'diet', type: 'TEXT' },
    });
    const res = await singlePUT(
      makeRequest('PUT', `/api/custom-field-templates/${t.id}`, { type: 'SELECT' }, userId),
      { params: Promise.resolve({ id: t.id }) }
    );
    expect(res.status).toBe(400); // type field is not in the update schema
  });

  it('renames an option and cascades to existing values', async () => {
    const t = await prisma.customFieldTemplate.create({
      data: {
        userId, name: 'Diet', slug: 'diet', type: 'SELECT',
        options: ['vegan', 'omnivore'],
      },
    });
    const p = await prisma.person.create({ data: { userId, name: 'Alice' } });
    await prisma.personCustomFieldValue.create({
      data: { personId: p.id, templateId: t.id, value: 'vegan' },
    });

    const res = await singlePUT(
      makeRequest('PUT', `/api/custom-field-templates/${t.id}`, {
        options: ['plant-based', 'omnivore'],
      }, userId),
      { params: Promise.resolve({ id: t.id }) }
    );
    expect(res.status).toBe(200);
    const v = await prisma.personCustomFieldValue.findUnique({
      where: { personId_templateId: { personId: p.id, templateId: t.id } },
    });
    expect(v?.value).toBe('plant-based');
  });

  it('soft-deletes', async () => {
    const t = await prisma.customFieldTemplate.create({
      data: { userId, name: 'Diet', slug: 'diet', type: 'TEXT' },
    });
    const res = await singleDELETE(
      makeRequest('DELETE', `/api/custom-field-templates/${t.id}`, undefined, userId),
      { params: Promise.resolve({ id: t.id }) }
    );
    expect(res.status).toBe(200);
    const fresh = await prisma.customFieldTemplate.findUnique({ where: { id: t.id } });
    expect(fresh?.deletedAt).not.toBeNull();
  });
});
```

> Note: replicate whatever request/session helpers the rest of `tests/api/*.test.ts` uses — peek at `tests/api/groups.test.ts` for the right conventions. Don't invent new helpers.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/api/custom-field-templates.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `app/api/custom-field-templates/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiResponse } from '@/lib/api-response';
import { customFieldTemplateCreateSchema } from '@/lib/validations';
import { canCreateResource } from '@/lib/billing/subscription';
import { deriveSlug } from '@/lib/customFields/slug';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiResponse.unauthorized();

  const templates = await prisma.customFieldTemplate.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  return apiResponse.ok({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiResponse.unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = customFieldTemplateCreateSchema.safeParse(body);
  if (!parsed.success) return apiResponse.error(parsed.error.issues[0].message);

  const limitCheck = await canCreateResource(session.user.id, 'customFieldTemplates');
  if (!limitCheck.allowed) {
    return apiResponse.forbidden(
      `You can create up to ${limitCheck.limit} custom field(s) on your current plan. Please upgrade to add more.`
    );
  }

  const slug = deriveSlug(parsed.data.name);
  if (!slug) return apiResponse.error('Name must contain at least one alphanumeric character');

  // Determine next order
  const last = await prisma.customFieldTemplate.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const order = (last?.order ?? -1) + 1;

  try {
    const template = await prisma.customFieldTemplate.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name.trim(),
        slug,
        type: parsed.data.type,
        options: parsed.data.options ?? [],
        order,
      },
    });
    return apiResponse.created({ template });
  } catch (e: unknown) {
    if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
      return apiResponse.conflict('A custom field with this name already exists');
    }
    throw e;
  }
}
```

- [ ] **Step 4: Implement `app/api/custom-field-templates/[id]/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiResponse } from '@/lib/api-response';
import { customFieldTemplateUpdateSchema } from '@/lib/validations';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiResponse.unauthorized();
  const { id } = await ctx.params;

  const template = await prisma.customFieldTemplate.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!template) return apiResponse.notFound('Template not found');
  return apiResponse.ok({ template });
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiResponse.unauthorized();
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const parsed = customFieldTemplateUpdateSchema.safeParse(body);
  if (!parsed.success) return apiResponse.error(parsed.error.issues[0].message);

  const existing = await prisma.customFieldTemplate.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!existing) return apiResponse.notFound('Template not found');

  // Build option-rename map (old → new) by index alignment, only when both arrays exist and have equal length.
  // We rely on the order returned by the client UI to identify renames.
  const renames: Array<[string, string]> = [];
  if (parsed.data.options && existing.type === 'SELECT') {
    const oldOpts = existing.options;
    const newOpts = parsed.data.options;
    if (oldOpts.length === newOpts.length) {
      for (let i = 0; i < oldOpts.length; i++) {
        if (oldOpts[i] !== newOpts[i]) {
          renames.push([oldOpts[i], newOpts[i]]);
        }
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.customFieldTemplate.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.options !== undefined ? { options: parsed.data.options } : {}),
      },
    });

    for (const [oldVal, newVal] of renames) {
      await tx.personCustomFieldValue.updateMany({
        where: { templateId: id, value: oldVal },
        data: { value: newVal },
      });
    }

    return t;
  });

  return apiResponse.ok({ template: updated });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiResponse.unauthorized();
  const { id } = await ctx.params;

  const existing = await prisma.customFieldTemplate.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
  });
  if (!existing) return apiResponse.notFound('Template not found');

  await prisma.customFieldTemplate.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return apiResponse.ok({ success: true });
}
```

> The option-rename strategy assumes the client sends the full `options` array in the same order. If the user reorders or deletes mid-array, the index alignment will produce surprising "renames." If the existing project has a UX convention for editing arrays (preserve original order, append new at end), follow it; otherwise we accept the limitation — the spec calls renames out as the only auto-update action, and the form should not allow reordering options on edit (only add/remove/rename).

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/api/custom-field-templates.test.ts
```

Expected: PASS for all eight cases. If `apiResponse.created`/`conflict` helpers don't exist in the project, replace with whatever the project uses (check `lib/api-response.ts`).

- [ ] **Step 6: Commit**

```bash
git add app/api/custom-field-templates tests/api/custom-field-templates.test.ts
git commit -m "feat(custom-fields): add list/create/read/update/delete API"
```

---

## Task 7: API — reorder

**Files:**
- Create: `app/api/custom-field-templates/reorder/route.ts`
- Modify: `tests/api/custom-field-templates.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/api/custom-field-templates.test.ts`:

```typescript
import { PUT as reorderPUT } from '../../app/api/custom-field-templates/reorder/route';

describe('reorder', () => {
  it('updates order to match the provided id list', async () => {
    const a = await prisma.customFieldTemplate.create({
      data: { userId, name: 'A', slug: 'a', type: 'TEXT', order: 0 },
    });
    const b = await prisma.customFieldTemplate.create({
      data: { userId, name: 'B', slug: 'b', type: 'TEXT', order: 1 },
    });
    const c = await prisma.customFieldTemplate.create({
      data: { userId, name: 'C', slug: 'c', type: 'TEXT', order: 2 },
    });

    const res = await reorderPUT(makeRequest('PUT', '/api/custom-field-templates/reorder', {
      ids: [c.id, a.id, b.id],
    }, userId));
    expect(res.status).toBe(200);

    const fresh = await prisma.customFieldTemplate.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
    expect(fresh.map((t) => t.id)).toEqual([c.id, a.id, b.id]);
  });

  it('rejects ids that do not all belong to the user', async () => {
    const otherUser = await /* create another user */;
    const stranger = await prisma.customFieldTemplate.create({
      data: { userId: otherUser.id, name: 'X', slug: 'x', type: 'TEXT' },
    });
    const res = await reorderPUT(makeRequest('PUT', '/api/custom-field-templates/reorder', {
      ids: [stranger.id],
    }, userId));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/api/custom-field-templates.test.ts -t reorder
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement reorder route**

Create `app/api/custom-field-templates/reorder/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiResponse } from '@/lib/api-response';
import { customFieldTemplateReorderSchema } from '@/lib/validations';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return apiResponse.unauthorized();

  const body = await req.json().catch(() => null);
  const parsed = customFieldTemplateReorderSchema.safeParse(body);
  if (!parsed.success) return apiResponse.error(parsed.error.issues[0].message);

  // Verify every id belongs to the user and is not deleted
  const owned = await prisma.customFieldTemplate.findMany({
    where: {
      id: { in: parsed.data.ids },
      userId: session.user.id,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (owned.length !== parsed.data.ids.length) {
    return apiResponse.error('Invalid id list');
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, idx) =>
      prisma.customFieldTemplate.update({
        where: { id },
        data: { order: idx },
      })
    )
  );

  return apiResponse.ok({ success: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/api/custom-field-templates.test.ts -t reorder
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/custom-field-templates/reorder tests/api/custom-field-templates.test.ts
git commit -m "feat(custom-fields): add reorder API"
```

---

## Task 8: OpenAPI spec entries

**Files:**
- Create: `lib/openapi/customFields.ts`
- Modify: `lib/openapi/index.ts`
- Modify: `tests/api/openapi-spec.test.ts`

- [ ] **Step 1: Create paths module**

Create `lib/openapi/customFields.ts`:

```typescript
import {
  customFieldTemplateCreateSchema,
  customFieldTemplateUpdateSchema,
  customFieldTemplateReorderSchema,
} from '../validations';
import { zodBody, pathParam, jsonResponse, ref400, ref401, ref404, refSuccess, resp } from './helpers';

export function customFieldsPaths(): Record<string, Record<string, unknown>> {
  return {
    '/api/custom-field-templates': {
      get: {
        tags: ['Custom Fields'],
        summary: 'List custom field templates',
        description: 'Returns active custom field templates for the authenticated user.',
        security: [{ session: [] }],
        responses: {
          '200': jsonResponse('List of templates', {
            type: 'object',
            properties: {
              templates: {
                type: 'array',
                items: { $ref: '#/components/schemas/CustomFieldTemplate' },
              },
            },
          }),
          '401': ref401(),
        },
      },
      post: {
        tags: ['Custom Fields'],
        summary: 'Create a custom field template',
        description: 'Creates a typed custom field schema. Slug is derived from name and immutable.',
        security: [{ session: [] }],
        requestBody: zodBody(customFieldTemplateCreateSchema),
        responses: {
          '201': jsonResponse('Template created', {
            type: 'object',
            properties: { template: { $ref: '#/components/schemas/CustomFieldTemplate' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '403': resp('Plan limit reached'),
          '409': resp('A template with this slug already exists'),
        },
      },
    },
    '/api/custom-field-templates/{id}': {
      get: {
        tags: ['Custom Fields'],
        summary: 'Get a custom field template',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'string')],
        responses: {
          '200': jsonResponse('Template', {
            type: 'object',
            properties: { template: { $ref: '#/components/schemas/CustomFieldTemplate' } },
          }),
          '401': ref401(),
          '404': ref404(),
        },
      },
      put: {
        tags: ['Custom Fields'],
        summary: 'Update a custom field template',
        description: 'Updates name and/or options. Type and slug are immutable.',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'string')],
        requestBody: zodBody(customFieldTemplateUpdateSchema),
        responses: {
          '200': jsonResponse('Template updated', {
            type: 'object',
            properties: { template: { $ref: '#/components/schemas/CustomFieldTemplate' } },
          }),
          '400': ref400(),
          '401': ref401(),
          '404': ref404(),
        },
      },
      delete: {
        tags: ['Custom Fields'],
        summary: 'Soft-delete a custom field template',
        security: [{ session: [] }],
        parameters: [pathParam('id', 'string')],
        responses: {
          '200': refSuccess(),
          '401': ref401(),
          '404': ref404(),
        },
      },
    },
    '/api/custom-field-templates/reorder': {
      put: {
        tags: ['Custom Fields'],
        summary: 'Reorder templates',
        security: [{ session: [] }],
        requestBody: zodBody(customFieldTemplateReorderSchema),
        responses: {
          '200': refSuccess(),
          '400': ref400(),
          '401': ref401(),
        },
      },
    },
  };
}
```

- [ ] **Step 2: Add the `CustomFieldTemplate` shared schema**

Open `lib/openapi/schemas.ts`, find where `Group`/`Person` schemas are defined, and add:

```typescript
CustomFieldTemplate: {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    slug: { type: 'string' },
    type: { type: 'string', enum: ['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT'] },
    options: { type: 'array', items: { type: 'string' } },
    order: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'name', 'slug', 'type', 'options', 'order'],
},
```

- [ ] **Step 3: Register the paths in `lib/openapi/index.ts`**

Add to imports:

```typescript
import { customFieldsPaths } from './customFields';
```

Add the tag to the `tags: [...]` array:

```typescript
{ name: 'Custom Fields', description: 'User-defined typed fields on people' },
```

In the `paths` block of `generateOpenAPISpec`, spread the new module's output alongside the others:

```typescript
paths: {
  ...authPaths(),
  ...peoplePaths(),
  ...groupsPaths(),
  ...customFieldsPaths(),
  ...relationshipsPaths(),
  // ...
},
```

- [ ] **Step 4: Add tag and path assertions to the spec test**

Edit `tests/api/openapi-spec.test.ts`. In the "should define all expected tags" test, add:

```typescript
expect(tagNames).toContain('Custom Fields');
```

In the "should have paths for all new endpoints" test, add:

```typescript
expect(spec.paths['/api/custom-field-templates']).toBeDefined();
expect(spec.paths['/api/custom-field-templates/{id}']).toBeDefined();
expect(spec.paths['/api/custom-field-templates/reorder']).toBeDefined();
```

- [ ] **Step 5: Run the spec test**

```bash
npx vitest run tests/api/openapi-spec.test.ts
```

Expected: PASS, all `$ref` references resolve.

- [ ] **Step 6: Commit**

```bash
git add lib/openapi tests/api/openapi-spec.test.ts
git commit -m "feat(custom-fields): add OpenAPI spec entries"
```

---

## Task 9: Person value handling on create / update

**Files:**
- Modify: `lib/validations.ts`
- Modify: `app/api/people/route.ts`
- Modify: `app/api/people/[id]/route.ts`
- Create: `tests/api/people-custom-fields.test.ts`

- [ ] **Step 1: Wire `customFieldValues` into the existing person Zod schemas**

Open `lib/validations.ts`. Find `createPersonSchema` and `updatePersonSchema`. Add `customFieldValues: customFieldValuesArraySchema` to both.

If those schemas are nested in larger composed shapes, add it at the top level of the shape that the API handlers parse against.

- [ ] **Step 2: Write the failing test**

Create `tests/api/people-custom-fields.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { POST as peoplePOST } from '../../app/api/people/route';
import { PUT as personPUT } from '../../app/api/people/[id]/route';
import { prisma } from '../../lib/prisma';
import { createTestSession, makeRequest } from './_helpers';

describe('Person custom field values', () => {
  let userId: string;
  let templateId: string;

  beforeEach(async () => {
    userId = await /* create user */;
    const t = await prisma.customFieldTemplate.create({
      data: {
        userId, name: 'Diet', slug: 'diet', type: 'SELECT', options: ['vegan', 'omnivore'],
      },
    });
    templateId = t.id;
  });

  it('creates values on POST /api/people', async () => {
    const res = await peoplePOST(makeRequest('POST', '/api/people', {
      name: 'Alice',
      customFieldValues: [{ templateId, value: 'vegan' }],
    }, userId));
    expect(res.status).toBe(201);
    const body = await res.json();
    const v = await prisma.personCustomFieldValue.findUnique({
      where: { personId_templateId: { personId: body.person.id, templateId } },
    });
    expect(v?.value).toBe('vegan');
  });

  it('rejects values that fail type validation', async () => {
    const res = await peoplePOST(makeRequest('POST', '/api/people', {
      name: 'Bob',
      customFieldValues: [{ templateId, value: 'pescatarian' }],
    }, userId));
    expect(res.status).toBe(400);
  });

  it('upserts and deletes via PUT /api/people/[id]', async () => {
    const p = await prisma.person.create({ data: { userId, name: 'Carla' } });
    await prisma.personCustomFieldValue.create({
      data: { personId: p.id, templateId, value: 'vegan' },
    });

    // PUT with new value → updated
    const res1 = await personPUT(
      makeRequest('PUT', `/api/people/${p.id}`, {
        name: 'Carla',
        customFieldValues: [{ templateId, value: 'omnivore' }],
      }, userId),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res1.status).toBe(200);
    const v1 = await prisma.personCustomFieldValue.findUnique({
      where: { personId_templateId: { personId: p.id, templateId } },
    });
    expect(v1?.value).toBe('omnivore');

    // PUT with empty array → row deleted
    const res2 = await personPUT(
      makeRequest('PUT', `/api/people/${p.id}`, {
        name: 'Carla',
        customFieldValues: [],
      }, userId),
      { params: Promise.resolve({ id: p.id }) }
    );
    expect(res2.status).toBe(200);
    const v2 = await prisma.personCustomFieldValue.findUnique({
      where: { personId_templateId: { personId: p.id, templateId } },
    });
    expect(v2).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run tests/api/people-custom-fields.test.ts
```

Expected: FAIL — handlers don't accept the field yet.

- [ ] **Step 4: Implement the upsert/diff logic in `app/api/people/route.ts`**

Inside the `POST` handler, after the person is created (search for `await createPerson(...)` or the equivalent insert), and before the response is returned, add:

```typescript
if (validation.data.customFieldValues && validation.data.customFieldValues.length > 0) {
  await applyCustomFieldValues(prisma, session.user.id, person.id, validation.data.customFieldValues);
}
```

Add a shared helper at `lib/customFields/persistence.ts`:

```typescript
import type { PrismaClient, CustomFieldType } from '@prisma/client';
import { validateRawValue, isEmptyRawValue } from './values';

export async function applyCustomFieldValues(
  prisma: PrismaClient,
  userId: string,
  personId: string,
  inputs: Array<{ templateId: string; value: string }>
): Promise<void> {
  if (inputs.length === 0) {
    await prisma.personCustomFieldValue.deleteMany({ where: { personId } });
    return;
  }

  // Load templates once and validate
  const templateIds = Array.from(new Set(inputs.map((i) => i.templateId)));
  const templates = await prisma.customFieldTemplate.findMany({
    where: { id: { in: templateIds }, userId, deletedAt: null },
  });
  const byId = new Map(templates.map((t) => [t.id, t]));

  for (const input of inputs) {
    const t = byId.get(input.templateId);
    if (!t) {
      throw new CustomFieldValidationError(`Template ${input.templateId} not found`);
    }
    if (isEmptyRawValue(input.value)) {
      throw new CustomFieldValidationError('Empty values must be omitted, not sent');
    }
    const result = validateRawValue(t.type as CustomFieldType, input.value, t.options);
    if (!result.ok) {
      throw new CustomFieldValidationError(`${t.name}: ${result.error}`);
    }
  }

  const incomingIds = new Set(inputs.map((i) => i.templateId));

  await prisma.$transaction([
    // delete rows for templates not in the new set
    prisma.personCustomFieldValue.deleteMany({
      where: { personId, templateId: { notIn: Array.from(incomingIds) } },
    }),
    // upsert each
    ...inputs.map((input) =>
      prisma.personCustomFieldValue.upsert({
        where: { personId_templateId: { personId, templateId: input.templateId } },
        create: { personId, templateId: input.templateId, value: input.value },
        update: { value: input.value },
      })
    ),
  ]);
}

export class CustomFieldValidationError extends Error {}
```

In the `POST /api/people` and `PUT /api/people/[id]` handlers, wrap the `applyCustomFieldValues` call in a try/catch that returns `apiResponse.error(err.message)` on `CustomFieldValidationError`.

The same call goes in `PUT /api/people/[id]` after the existing person update, before the response. Pass `validation.data.customFieldValues` (which may be `undefined` — if undefined, skip the call so existing values are not touched; only an explicit empty array clears).

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run tests/api/people-custom-fields.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run all api tests to confirm no regression**

```bash
npx vitest run tests/api
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/customFields/persistence.ts lib/validations.ts app/api/people tests/api/people-custom-fields.test.ts
git commit -m "feat(custom-fields): accept customFieldValues on person create/update"
```

---

## Task 10: CardDAV export

**Files:**
- Create: `lib/customFields/serialize.ts`
- Modify: `lib/carddav/vcard.ts`
- Create: `tests/lib/customFields-serialize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/customFields-serialize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildCustomFieldXLines,
  customFieldXKey,
  filterFreeFormCustomFieldsAgainstTemplates,
} from '../../lib/customFields/serialize';

describe('customFieldXKey', () => {
  it('uppercases the slug', () => {
    expect(customFieldXKey('dietary-restriction')).toBe('X-NAMETAG-FIELD-DIETARY-RESTRICTION');
  });
});

describe('buildCustomFieldXLines', () => {
  it('emits one line per template-backed value with TYPE param', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'diet', type: 'SELECT', deletedAt: null },
        value: 'vegan',
      },
      {
        template: { slug: 'has-pets', type: 'BOOLEAN', deletedAt: null },
        value: 'true',
      },
    ]);
    expect(lines).toEqual([
      { key: 'X-NAMETAG-FIELD-DIET', params: { TYPE: 'NAMETAG-FIELD-SELECT' }, value: 'vegan' },
      { key: 'X-NAMETAG-FIELD-HAS-PETS', params: { TYPE: 'NAMETAG-FIELD-BOOLEAN' }, value: 'true' },
    ]);
  });

  it('skips soft-deleted templates', () => {
    const lines = buildCustomFieldXLines([
      {
        template: { slug: 'diet', type: 'TEXT', deletedAt: new Date() },
        value: 'vegan',
      },
    ]);
    expect(lines).toEqual([]);
  });
});

describe('filterFreeFormCustomFieldsAgainstTemplates', () => {
  it('drops free-form X- entries whose key matches a template-backed key', () => {
    const filtered = filterFreeFormCustomFieldsAgainstTemplates(
      [
        { key: 'X-NAMETAG-FIELD-DIET', value: 'old' }, // collides
        { key: 'X-LINKEDIN', value: 'https://example.com' }, // unrelated
      ],
      ['X-NAMETAG-FIELD-DIET']
    );
    expect(filtered).toEqual([{ key: 'X-LINKEDIN', value: 'https://example.com' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/lib/customFields-serialize.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/customFields/serialize.ts`**

```typescript
import type { CustomFieldType } from '@prisma/client';

export function customFieldXKey(slug: string): string {
  return `X-NAMETAG-FIELD-${slug.toUpperCase()}`;
}

export interface SerializeInput {
  template: { slug: string; type: CustomFieldType; deletedAt: Date | null };
  value: string;
}

export interface XLine {
  key: string;
  params: { TYPE: string };
  value: string;
}

export function buildCustomFieldXLines(inputs: SerializeInput[]): XLine[] {
  const out: XLine[] = [];
  for (const input of inputs) {
    if (input.template.deletedAt !== null) continue;
    out.push({
      key: customFieldXKey(input.template.slug),
      params: { TYPE: `NAMETAG-FIELD-${input.template.type}` },
      value: input.value,
    });
  }
  return out;
}

export function filterFreeFormCustomFieldsAgainstTemplates<T extends { key: string }>(
  freeForm: T[],
  templateKeys: string[]
): T[] {
  const blocked = new Set(templateKeys);
  return freeForm.filter((f) => !blocked.has(f.key));
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/lib/customFields-serialize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Wire into `lib/carddav/vcard.ts`**

Read `lib/carddav/vcard.ts`. Find the function that serializes a `Person` to a vCard string (likely something like `personToVCard` or `buildVCard`). It iterates the person's `customFields` (free-form X-) and emits lines.

Modify it to:

1. Also iterate the person's `customFieldValues` (template-backed) — caller must include them in the include block.
2. Build the list of `templateKeys = customFieldValues.map(v => customFieldXKey(v.template.slug))`.
3. Call `filterFreeFormCustomFieldsAgainstTemplates(person.customFields, templateKeys)` to suppress duplicates.
4. Emit the template-backed X-lines from `buildCustomFieldXLines(...)`.

Update the Prisma include block in any export-side code (search `customFields:` in `app/api/carddav/`) to also include `customFieldValues: { include: { template: true } }` filtered by `template: { deletedAt: null }`.

- [ ] **Step 6: Add a vCard-level integration test**

Find the existing vCard generation tests (look for `tests/lib/vcard.test.ts` or `tests/api/carddav-*.test.ts`). Add one case:

```typescript
it('emits X-NAMETAG-FIELD-* for template-backed values and suppresses colliding free-form X-', async () => {
  // Arrange person with one template value (slug=diet) and one free-form X-NAMETAG-FIELD-DIET
  // Act: generate vCard
  // Assert: exactly one X-NAMETAG-FIELD-DIET line, sourced from the template value, with TYPE=NAMETAG-FIELD-SELECT
});
```

- [ ] **Step 7: Run all CardDAV tests**

```bash
npx vitest run tests/lib/customFields-serialize.test.ts tests/api/carddav-import-limits.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/customFields/serialize.ts lib/carddav/vcard.ts tests/lib/customFields-serialize.test.ts
git commit -m "feat(custom-fields): export template values as X-NAMETAG-FIELD-* on CardDAV"
```

---

## Task 11: i18n keys

**Files:**
- Modify: `locales/en.json`, `es-ES.json`, `de-DE.json`, `ja-JP.json`, `nb-NO.json`, `zh-CN.json`

- [ ] **Step 1: Add the `customFields` namespace to `locales/en.json`**

Add a top-level key `customFields` with this shape:

```json
"customFields": {
  "settings": {
    "title": "Custom fields",
    "description": "Define your own fields and apply them to all your people.",
    "newButton": "New field",
    "emptyTitle": "No custom fields yet",
    "emptyDescription": "Add fields like dietary restrictions, hobbies, or pets, and use them to filter your people.",
    "usageMeter": "{used} of {limit} custom fields",
    "usageMeterUnlimited": "{used} custom fields"
  },
  "form": {
    "nameLabel": "Name",
    "namePlaceholder": "e.g. Dietary restriction",
    "typeLabel": "Type",
    "typeText": "Text",
    "typeNumber": "Number",
    "typeBoolean": "Yes / No",
    "typeSelect": "Single-select",
    "typeLockedNotice": "Type can't be changed after creation.",
    "optionsLabel": "Options",
    "optionPlaceholder": "Option",
    "addOption": "Add option",
    "removeOption": "Remove",
    "saveButton": "Save",
    "cancelButton": "Cancel",
    "deleteButton": "Delete"
  },
  "delete": {
    "confirmTitle": "Delete custom field?",
    "confirmBody": "{count, plural, =0 {No people use this field.} =1 {# person has a value for this field.} other {# people have values for this field.}}",
    "confirmAction": "Delete",
    "cancel": "Cancel"
  },
  "errors": {
    "duplicateName": "A custom field with this name already exists.",
    "selectRequiresOptions": "Single-select fields need at least one option.",
    "notANumber": "Must be a number.",
    "notInOptions": "Must be one of the listed options.",
    "limitReached": "You can create up to {limit} custom field(s) on your current plan."
  },
  "person": {
    "sectionTitle": "Custom fields",
    "booleanYes": "Yes",
    "booleanNo": "No",
    "booleanNotSet": "Not set",
    "selectEmpty": "—",
    "valueOutOfOptions": "This value is no longer in the field's options."
  },
  "filter": {
    "moreFilters": "More filters",
    "selectField": "Select a field",
    "applyButton": "Apply",
    "clearLabel": "Clear filter"
  }
}
```

- [ ] **Step 2: Mirror the same key tree into the other five locale files**

Translate values for `es-ES`, `de-DE`, `ja-JP`, `nb-NO`, `zh-CN`. Keys identical, values translated. CLAUDE.md rule 2 — every key must exist in every locale.

- [ ] **Step 3: Verify locale completeness**

If the project has a `npm run check:i18n` script or similar, run it. Otherwise grep:

```bash
for f in locales/*.json; do echo "$f"; node -e "console.log(Object.keys(require('./$f').customFields || {}).sort().join(','))"; done
```

Expected: every locale prints the same comma-separated key list.

- [ ] **Step 4: Commit**

```bash
git add locales/
git commit -m "i18n(custom-fields): add customFields namespace in all six locales"
```

---

## Task 12: Settings page — manage templates

**Files:**
- Create: `app/settings/custom-fields/page.tsx`
- Create: `components/customFields/CustomFieldTemplateList.tsx`
- Create: `components/customFields/CustomFieldTemplateForm.tsx`
- Modify: `app/settings/page.tsx` or whatever the settings index navigation file is

- [ ] **Step 1: Create the page (server component)**

`app/settings/custom-fields/page.tsx`:

```typescript
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import { canCreateResource } from '@/lib/billing/subscription';
import { isFeatureEnabled } from '@/lib/features';
import CustomFieldTemplateList from '@/components/customFields/CustomFieldTemplateList';

export default async function CustomFieldsSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const t = await getTranslations('customFields.settings');

  const templates = await prisma.customFieldTemplate.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });

  const usage = isFeatureEnabled('tierLimits')
    ? await canCreateResource(session.user.id, 'customFieldTemplates')
    : null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
        {usage && (
          <p className="text-xs text-muted-foreground mt-2">
            {usage.isUnlimited
              ? t('usageMeterUnlimited', { used: usage.current })
              : t('usageMeter', { used: usage.current, limit: usage.limit })}
          </p>
        )}
      </header>
      <CustomFieldTemplateList
        initialTemplates={templates}
        canCreateMore={usage ? usage.allowed : true}
      />
    </div>
  );
}
```

- [ ] **Step 2: Implement the list component (client)**

`components/customFields/CustomFieldTemplateList.tsx`. Render rows with type badges, edit/delete affordances, and a "New field" button that opens the form. Reorder via drag handle (use the same library the rest of Nametag uses — search the codebase for `dnd-kit` or similar; do not introduce a new dep).

Show one inline form (the `CustomFieldTemplateForm`) above the list when in "create" mode, and inline beneath the row in "edit" mode.

Actions:
- Create: `POST /api/custom-field-templates`, then refresh.
- Update: `PUT /api/custom-field-templates/[id]`.
- Delete: open confirm dialog with i18n `delete.confirmBody` (count comes from a small `GET /api/custom-field-templates/[id]/usage` you may add, or from a count returned in the list — see Step 3 below).
- Reorder: on drag end, `PUT /api/custom-field-templates/reorder`.

Refresh the page with `router.refresh()` after any mutation.

- [ ] **Step 3: Include person-value count on the list endpoint**

Update `GET /api/custom-field-templates` to include the count:

```typescript
const templates = await prisma.customFieldTemplate.findMany({
  where: { userId: session.user.id, deletedAt: null },
  orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  include: { _count: { select: { values: true } } },
});
```

The list component uses `template._count.values` for the delete confirmation copy.

- [ ] **Step 4: Implement the form component (client)**

`components/customFields/CustomFieldTemplateForm.tsx` — controlled form with name, type radio group, options block (visible only when type=SELECT). On edit, type radio group is disabled; show `form.typeLockedNotice`.

Inline error rendering: surface validation errors from the API response into the field that produced them (project pattern — match what `components/PersonForm` does).

- [ ] **Step 5: Add the page to the settings navigation**

Open the settings index page (`app/settings/page.tsx` or sidebar component, search for the existing entry for "CardDAV") and add a link to `/settings/custom-fields` with an appropriate icon and the i18n title.

- [ ] **Step 6: Manually smoke-test in dev**

```bash
npm run dev
```

Visit `/settings/custom-fields`. Create a SELECT field "Dietary restriction" with options vegan/omnivore. Edit it, rename "vegan" → "plant-based" (no values yet). Soft-delete it. Confirm it disappears.

- [ ] **Step 7: Commit**

```bash
git add app/settings/custom-fields components/customFields/CustomFieldTemplateList.tsx components/customFields/CustomFieldTemplateForm.tsx app/settings/page.tsx app/api/custom-field-templates/route.ts
git commit -m "feat(custom-fields): settings page to manage templates"
```

---

## Task 13: Person form integration

**Files:**
- Create: `components/customFields/CustomFieldsSection.tsx`
- Modify: the shared person form component (search for `<PersonForm` or `app/people/new/page.tsx` to find it)

- [ ] **Step 1: Implement the section component**

`components/customFields/CustomFieldsSection.tsx` — client component. Props: `templates: CustomFieldTemplate[]`, `values: Array<{ templateId, value }>`, `onChange: (values) => void`. Renders nothing if `templates.length === 0`.

For each template, render the appropriate input:

```typescript
switch (template.type) {
  case 'TEXT':
    return <input type="text" value={current ?? ''} onChange={...} />;
  case 'NUMBER':
    return <input type="number" step="any" value={current ?? ''} onChange={...} />;
  case 'BOOLEAN':
    return (
      <select value={current ?? ''} onChange={...}>
        <option value="">{t('person.booleanNotSet')}</option>
        <option value="true">{t('person.booleanYes')}</option>
        <option value="false">{t('person.booleanNo')}</option>
      </select>
    );
  case 'SELECT':
    return (
      <select value={current ?? ''} onChange={...}>
        <option value="">{t('person.selectEmpty')}</option>
        {template.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
}
```

When the user clears an input (empty string), remove that template's entry from the `values` array. Otherwise upsert.

For SELECT, if `current` is set but not in `template.options`, render the value plus a small warning text using `customFields.person.valueOutOfOptions`.

- [ ] **Step 2: Embed in the person form**

Find the shared person form component. Pass it the user's templates (loaded server-side via the page) and the person's existing `customFieldValues`. Add a state slice for the values, plumb it through to the request body as `customFieldValues`.

Place the section between "Other vCard fields" and the existing X-properties section (label that section explicitly via i18n so users see the distinction; no new strings needed if the existing label already reads "X-Properties" or similar).

- [ ] **Step 3: Update the person fetch to include `customFieldValues`**

Where the person edit page loads the person (`app/people/[id]/page.tsx` and the edit page), extend the Prisma include block:

```typescript
customFieldValues: {
  include: { template: true },
  where: { template: { deletedAt: null } },
},
```

Also load the user's templates separately:

```typescript
const templates = await prisma.customFieldTemplate.findMany({
  where: { userId: session.user.id, deletedAt: null },
  orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
});
```

Pass both to the form.

- [ ] **Step 4: Manually smoke-test**

Edit a person, set values for the new field, save, reload. Verify the values persist. Clear a value, save — verify the row disappears in the DB.

- [ ] **Step 5: Commit**

```bash
git add components/customFields/CustomFieldsSection.tsx app/people
git commit -m "feat(custom-fields): render template fields on person form"
```

---

## Task 14: Person detail page

**Files:**
- Modify: `app/people/[id]/page.tsx`

- [ ] **Step 1: Render the values section**

In the detail page, below the existing "Other vCard fields" section and above the X-properties section, render:

```tsx
{person.customFieldValues.length > 0 && (
  <section className="mt-6">
    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
      {t('customFields.person.sectionTitle')}
    </h2>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {person.customFieldValues.map((v) => (
        <div key={v.id}>
          <dt className="text-xs text-muted-foreground">{v.template.name}</dt>
          <dd className="text-sm text-foreground">
            {formatValueForDisplay(v.template.type, v.value)}
          </dd>
        </div>
      ))}
    </dl>
  </section>
)}
```

`formatValueForDisplay` comes from `lib/customFields/values.ts`. The "Yes" / "No" labels there are placeholders — the detail page should call the i18n version of those. Either replace the inline call with a small client helper that maps `BOOLEAN` to translated strings, or keep `formatValueForDisplay` as-is and override in the JSX:

```typescript
const display = v.template.type === 'BOOLEAN'
  ? (v.value === 'true' ? t('customFields.person.booleanYes') : t('customFields.person.booleanNo'))
  : formatValueForDisplay(v.template.type, v.value);
```

- [ ] **Step 2: Manually smoke-test**

Visit `/people/<id>` for a person with values. Verify the section renders with translated labels in both EN and ES (toggle locale).

- [ ] **Step 3: Commit**

```bash
git add app/people/[id]/page.tsx
git commit -m "feat(custom-fields): show template values on person detail page"
```

---

## Task 15: People list filter

**Files:**
- Modify: `app/people/page.tsx`
- Create: `components/customFields/CustomFieldFilter.tsx`

- [ ] **Step 1: Extend `searchParams` typing**

In `app/people/page.tsx`, add `cf` to the searchParams type:

```typescript
searchParams: Promise<{
  page?: string;
  sortBy?: string;
  order?: string;
  group?: string;
  relationship?: string;
  cf?: string; // format "<slug>:<value>"
}>;
```

- [ ] **Step 2: Parse the param and apply to the people query**

After parsing `params`, decode `cf`:

```typescript
let cfFilter: { slug: string; value: string } | null = null;
if (params.cf) {
  const idx = params.cf.indexOf(':');
  if (idx > 0) {
    cfFilter = { slug: params.cf.slice(0, idx), value: params.cf.slice(idx + 1) };
  }
}
```

Find the existing `prisma.person.findMany` (or service call) that produces the list. Add a `where` clause:

```typescript
...(cfFilter ? {
  customFieldValues: {
    some: {
      value: cfFilter.value,
      template: {
        slug: cfFilter.slug,
        userId: session.user.id,
        deletedAt: null,
      },
    },
  },
} : {}),
```

If the people listing goes through a service helper, thread the filter through it the same way `group` and `relationship` are threaded today.

- [ ] **Step 3: Load templates server-side**

Load the user's templates and pass them to the filter component:

```typescript
const templates = await prisma.customFieldTemplate.findMany({
  where: { userId: session.user.id, deletedAt: null },
  orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
});
```

- [ ] **Step 4: Implement the filter UI component**

`components/customFields/CustomFieldFilter.tsx` — client component. Props: `templates`, `current: { slug, value } | null`. Renders:

- A "More filters" button (hidden if `templates.length === 0`).
- On click, opens a popover listing each template by name. Picking a template reveals an inline value picker (text/number input, Yes/No toggle, or select dropdown).
- On submit, push the new query param via `useRouter().push('/people?...')`. Preserve other params except `cf`.
- When a filter is active, render a chip in the row: `<button>{templateName}: {displayValue} ✕</button>` that clears `cf`.

The inline value picker must use `customFields.filter.applyButton`, `selectField`, `clearLabel` translations.

- [ ] **Step 5: Add the filter to the people page UI**

In the existing filter row (where the Group + Relationship dropdowns live), render `<CustomFieldFilter templates={templates} current={cfFilter} />` as the next child.

- [ ] **Step 6: Manually smoke-test**

Create a SELECT template "Diet" with options vegan/omnivore. Tag two people. Open `/people`, pick the "More filters" → Diet → vegan. Confirm only the vegan person shows. Remove the chip; full list returns.

Test that `?group=X&cf=diet:vegan` AND-combines correctly.

- [ ] **Step 7: Run all tests once more to confirm nothing regressed**

```bash
npx vitest run
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add app/people/page.tsx components/customFields/CustomFieldFilter.tsx
git commit -m "feat(custom-fields): filter people list by custom field value"
```

---

## Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: PASS, no skipped tests on new code.

- [ ] **Step 2: Run the typechecker and linter**

```bash
npx tsc --noEmit
npm run lint
```

Expected: clean.

- [ ] **Step 3: Run the OpenAPI spec check explicitly**

```bash
npx vitest run tests/api/openapi-spec.test.ts
```

Expected: PASS.

- [ ] **Step 4: Manual end-to-end test (golden path)**

In dev (`npm run dev`):

1. Sign in as a test user.
2. Settings → Custom Fields → New: create "Diet" (SELECT, options vegan/omnivore), "Has pets" (BOOLEAN), "Pet count" (NUMBER), "Note" (TEXT).
3. Verify the "More fields" filter appears on `/people`.
4. Pick a person → Edit → set values for all four → Save.
5. Confirm the person detail shows the values.
6. Filter `/people` by Diet=vegan; confirm filter chip appears and list narrows.
7. Settings → Custom Fields → rename Diet's "vegan" option to "plant-based"; reload person and confirm value updated.
8. Settings → Custom Fields → Delete "Pet count"; confirm it disappears from form, detail page, and filter.
9. (CardDAV smoke, if a connection is configured) Trigger an export and confirm the vCard contains `X-NAMETAG-FIELD-DIET;TYPE=NAMETAG-FIELD-SELECT:plant-based`.
10. Switch locale to Spanish; confirm all new strings render translated.

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin <branch>
gh pr create --title "feat: custom fields" --body "$(cat <<'EOF'
## Summary
- User-defined typed custom fields (Text / Number / Boolean / Single-select) for people, with single-value filtering on the people list and CardDAV export.
- Free-form X-property concept retained as the escape hatch.

## Test plan
- [x] Vitest suite green
- [x] OpenAPI spec test green
- [x] Manual golden path (settings, person form, filter, CardDAV export, i18n)

Closes #93
EOF
)"
```
