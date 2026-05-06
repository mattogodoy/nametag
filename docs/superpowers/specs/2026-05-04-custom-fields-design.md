# Custom Fields — Design Spec

**Date:** 2026-05-04
**Issue:** [#93 — Custom Fields](https://github.com/mattogodoy/nametag/issues/93)
**Status:** Approved

## Motivation

Users want to extend the `Person` schema with their own typed fields — dietary restrictions, hobbies, pets, "has kids," etc. — and filter the people list by those values. Notes are insufficient because they're untyped free text and can't be queried.

## Goals

- Let a user define typed custom fields once and have them apply across all their people.
- Support filtering the people list by a single custom-field value.
- Preserve custom-field data on CardDAV export so it survives a sync to another device or external client.
- Keep the existing free-form `PersonCustomField` (vCard `X-` escape hatch) intact and clearly distinct.

## Non-goals (deferred follow-ups)

- Combined multi-filter logic on the people list.
- Importing `X-NAMETAG-FIELD-*` back from CardDAV into templates.
- Multi-select, Date, URL, or Long-text field types.
- Per-group scoping of templates.
- Number range filters, text substring search.
- Required-field validation.
- End-user restore UI for deleted templates (admin-mediated only).
- Bulk operations across people.

## Architecture decisions (the discussion log)

These were brainstormed and locked in before this spec was written. They are the *why* behind the rest of the document.

1. **Two coexisting concepts.** User-level *templated* custom fields (this feature) live alongside the existing per-person free-form `PersonCustomField` (X-properties used by CardDAV). Templated fields are the structured/typed primary concept; free-form fields are the escape hatch.
2. **Field types — Lean set:** Text, Number, Boolean, Single-select. Multi-select declined (multiple Hobby templates handle it). Date and URL declined (already covered by `ImportantDate` and `PersonUrl`). Long text declined (that's `notes`).
3. **Filter scope:** Single custom-field filter at a time on the people list; AND-combined with the existing Group and Relationship filters. Combined custom-field filtering is a follow-up.
4. **CardDAV behavior:** Export-only as namespaced `X-NAMETAG-FIELD-<SLUG>`. We do not import these back into templates yet; foreign `X-NAMETAG-FIELD-*` values land in the existing free-form `PersonCustomField` table.
5. **Data model:** Separate tables for templates and values. Not a JSON blob, not an extension of the existing `PersonCustomField` table.
6. **Type is locked at create time.** No type conversion. To switch, delete and recreate.
7. **Boolean is three-state on the form** (Yes / No / Not set). Filter offers Yes and No explicitly.
8. **Single-select option rename auto-updates** all matching person values.
9. **Delete is soft-only and has no end-user restore path.** Confirmation tells the user how many people have a value; no "soft vs. hard" distinction in the UI.
10. **Tier limits (SaaS mode):** FREE = 1 template, PERSONAL = 20, PRO = unlimited.

## Data model

Two new tables, both following Nametag's existing patterns.

```prisma
enum CustomFieldType {
  TEXT
  NUMBER
  BOOLEAN
  SELECT
}

model CustomFieldTemplate {
  id        String          @id @default(cuid())
  userId    String
  name      String                              // user-facing label, editable
  slug      String                              // derived at create time, immutable
  type      CustomFieldType                     // immutable after create
  options   String[]                            // only meaningful when type = SELECT
  order     Int             @default(0)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  deletedAt DateTime?

  user   User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  values PersonCustomFieldValue[]

  @@unique([userId, slug])
  @@index([userId, deletedAt])
  @@map("custom_field_templates")
}

model PersonCustomFieldValue {
  id         String   @id @default(cuid())
  personId   String
  templateId String
  value      String   @db.Text                  // parsed by template.type at the edges
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  person   Person              @relation(fields: [personId], references: [id], onDelete: Cascade)
  template CustomFieldTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([personId, templateId])
  @@index([templateId, value])
  @@map("person_custom_field_values")
}
```

`Person` gets one new relation:

```prisma
customFieldValues PersonCustomFieldValue[]
```

### Notes on choices

- **Single `value: String` column** rather than typed columns. Simpler schema; v1 only does equality filtering, which is identical regardless of underlying type.
- **`@@unique([personId, templateId])`** — exactly one value per template per person. Multi-value handled by creating multiple templates.
- **`PersonCustomFieldValue` is not soft-deletable.** Clearing a value deletes the row. When a `Person` is hard-deleted, values cascade. When a template is soft-deleted, values stay in the DB and are silently invisible.
- **Slug is immutable.** It's the stable key used in CardDAV export and in URL filter params. Renaming the template changes only the user-facing `name`.

## Settings — managing templates

New page at `/settings/custom-fields`. Listed alongside existing Settings sections.

### List view

- Each row: name, type badge, options preview (SELECT only), edit / delete affordances, drag handle.
- "New field" button.
- Empty state explains the concept in plain copy (no docs page in scope).
- Drag-and-drop reorders, persists `order` via `PUT /api/custom-field-templates/reorder`.
- When `SAAS_MODE=true`: usage meter showing `<used>/<limit>` templates, matching the people/groups/reminders meters.

### Create form

- **Name** (required, unique per user).
- **Type** (required, radio/segmented control).
- **Options** (visible when type = SELECT, required ≥ 1, repeatable rows with add/remove).
- **Slug** (auto-derived from name; shown read-only on the form).

### Edit form

- **Name** editable.
- **Options** editable: add, remove, rename. Renaming an option auto-updates all matching person values in a single transaction (decision 8).
- **Type** disabled.
- **Slug** disabled.

### Delete

- Single "Delete" action. Confirmation modal shows the count of people with a value.
- Sets `deletedAt`; values stay in the DB but become invisible everywhere.
- No restore UI. Recovery is admin-mediated through direct DB access.

## Person form integration

The person form (`/people/new`, `/people/[id]/edit`) gets a new section, **"Custom fields"**, between the existing "Other vCard fields" and the existing free-form X-properties section.

- The section is hidden entirely when the user has zero active templates.
- Each template renders as a labeled input, ordered by `template.order`.

### Type-specific controls

- **Text:** single-line text input.
- **Number:** number input, decimals allowed. Validation: must parse as a finite number.
- **Boolean:** three-state control (Yes / No / Not set), defaulting to Not set.
- **Single-select:** native `<select>` with a "—" empty option for "not set." If the person's stored value is not in the template's current option list, render the value with a warning so the user can re-pick.

### Empty / not-set semantics

A blank Text, blank Number, or "Not set" Boolean/Select means "no value." The save handler deletes any existing `PersonCustomFieldValue` row for that template; we never persist empty rows.

### Person detail view

The person detail page (`/people/[id]`) shows the same section. Booleans render "Yes" / "No"; Selects render the value plain. Section is hidden if the person has no values.

### Free-form X-properties section

Stays exactly as it is today. Clearly labeled so users see the distinction between templated and free-form fields.

## People list filter

The `/people` page currently has Group + Relationship filters in a row.

### UI

- Group + Relationship stay as the always-visible primary filters.
- New **"More filters"** dropdown lists each active template by name, ordered by `template.order`. Hidden when the user has zero templates.
- Picking a template opens a value picker:
  - Text: text input (exact match).
  - Number: number input (exact match).
  - Boolean: Yes / No.
  - Single-select: dropdown of the template's current options.
- Once a value is picked, the active filter renders as a removable chip in the row, e.g. `[Dietary restriction: vegan ✕]`.

### URL parameter

- `?cf=<slug>:<value>` — single param, slug-based.
- Coexists with `?group=` and `?relationship=` (AND-combined). Picking a different custom-field filter replaces the previous `cf` param.

### Query

```sql
SELECT 1
FROM person_custom_field_values v
JOIN custom_field_templates t ON v.template_id = t.id
WHERE v.person_id = p.id
  AND t.user_id = $userId
  AND t.deleted_at IS NULL
  AND t.slug = $slug
  AND v.value = $value
```

The `@@index([templateId, value])` covers the inner predicate.

## CardDAV behavior

### Export

Each active (non-deleted) template-backed value on a person gets serialized as:

```
X-NAMETAG-FIELD-<UPPERCASED-SLUG>;TYPE=NAMETAG-FIELD-<TYPE>:<value>
```

| Field type | Serialized value |
| --- | --- |
| TEXT | string as-is |
| NUMBER | string representation, e.g. `"42"` |
| BOOLEAN | `"true"` / `"false"` |
| SELECT | the selected option string |

Soft-deleted templates and their values are skipped.

### Conflict with free-form X-properties

A user could create a template with slug `dietary-restriction` and *also* manually add a free-form `X-NAMETAG-FIELD-DIETARY-RESTRICTION` X- entry on the same person. On export, the template-backed value wins; any same-key free-form entry is suppressed. The UI does not prevent the conflict from being created.

### Import

Foreign `X-NAMETAG-FIELD-*` properties on incoming vCards land in the existing free-form `PersonCustomField` table, exactly as they do today. They do not auto-attach to templates and do not auto-create templates. Importing into templates is a deferred follow-up.

## API surface

All endpoints added to `lib/openapi.ts` (CLAUDE.md rule 6).

```
GET    /api/custom-field-templates              List active templates for current user
POST   /api/custom-field-templates              Create (enforce tier limit)
GET    /api/custom-field-templates/[id]         Read single template
PUT    /api/custom-field-templates/[id]         Update name and/or options
DELETE /api/custom-field-templates/[id]         Soft-delete

PUT    /api/custom-field-templates/reorder      Bulk reorder { ids: string[] }
```

Person values are managed inline through `PUT /api/people/[id]`. The body gains a `customFieldValues: Array<{ templateId: string, value: string }>` field. The handler diffs against existing rows: upserts present entries, deletes rows for templates not in the array. No standalone value endpoints. This mirrors the existing handling of phones, emails, addresses, etc.

## Validation

New Zod schemas in `lib/validations.ts`:

- `customFieldTemplateCreateSchema` — name, type, options (when type = SELECT, ≥ 1).
- `customFieldTemplateUpdateSchema` — name, options. Type and slug rejected.
- `customFieldValueSchema` — type-aware. Number must parse as finite. Select value must be in the referenced template's current options.

Server-side enforcement is authoritative — the form does its best, but never trust it.

## i18n

All user-facing strings in all six locale files (`en`, `es-ES`, `de-DE`, `ja-JP`, `nb-NO`, `zh-CN`). New namespace `customFields` covering: settings page, person form section, person detail section, filter UI, validation messages, delete confirmation.

## Soft-delete discipline

Per CLAUDE.md rule 4, every Prisma read on `CustomFieldTemplate` includes `deletedAt: null`. Reads on `PersonCustomFieldValue` join through `template: { deletedAt: null }` when the template's deletion state is relevant (i.e., everywhere except an admin clearing `deletedAt` directly in the DB to restore a template).

## Tier limits (SaaS mode)

`lib/billing/constants.ts` gains `customFieldTemplates` in `TIER_LIMITS`:

| Tier | Limit |
| --- | --- |
| FREE | 1 |
| PERSONAL | 20 |
| PRO | Infinity |

`LimitedResource` extends to `'customFieldTemplates'`. The `POST /api/custom-field-templates` handler checks the limit before insert. UI shows the usage meter on the Settings → Custom Fields page when `isFeatureEnabled('tierLimits')` is true. Limit only applies to non-deleted templates.

## Lifecycle and edge cases

| Event | Behavior |
| --- | --- |
| Template renamed | `name` updates; `slug` does not. CardDAV export keys remain stable. |
| Template type | Locked at create. To switch, delete and recreate. |
| SELECT option added | Trivial. Existing values unchanged. |
| SELECT option renamed | Auto-update all matching `PersonCustomFieldValue.value` rows in a single transaction. |
| SELECT option removed | Existing values referencing the removed option remain. Person form shows them with a warning. The filter dropdown will not list the removed option. |
| Template soft-deleted | Hidden from form, detail view, filter, CardDAV export. Values preserved in DB. No restore UI. |
| Person hard-deleted | Values cascade via FK. |
| User deleted | Templates and values cascade through the existing `User → Person → ...` chain. |
| Free-form X- with same key as a template's slug | Coexists in DB. CardDAV export prefers the template-backed value and suppresses the free-form duplicate. |
| Tier downgrade with N templates over limit | Existing templates remain functional. New creation is blocked until the user is under the new limit. We don't auto-delete. |

## Testing

Vitest covers:

- Schema validation for create/update/reorder/value.
- Slug derivation (collision behavior, normalization).
- Option-rename cascade updates all affected `PersonCustomFieldValue` rows.
- Soft-delete makes the template invisible to all read paths.
- Tier-limit enforcement on create (under, at, over).
- People-list filter query for each type.
- CardDAV export shape (key, TYPE param, value formatting per field type).
- Free-form / template conflict resolution on export.

`tests/api/openapi-spec.test.ts` re-runs to verify the spec is valid.

## File touchpoints (rough)

- `prisma/schema.prisma` — two new models, one enum, one relation on `Person`.
- `prisma/migrations/<ts>_add_custom_field_templates/` — generated migration.
- `lib/validations.ts` — new Zod schemas.
- `lib/billing/constants.ts` — `customFieldTemplates` limit; `LimitedResource` extended.
- `lib/openapi.ts` — new endpoint paths.
- `lib/carddav/vcard.ts` (and matching parser) — export logic for `X-NAMETAG-FIELD-*`.
- `lib/field-configs.ts` — possibly extend, or a new sibling file for templated fields.
- `app/api/custom-field-templates/route.ts` + `[id]/route.ts` + `reorder/route.ts` — new handlers.
- `app/api/people/route.ts`, `app/api/people/[id]/route.ts` — accept `customFieldValues` in body, diff/upsert.
- `app/people/page.tsx` — extend `searchParams`, add "More filters" UI, wire query.
- `app/people/[id]/page.tsx` — render custom-field section.
- `app/people/[id]/edit/page.tsx`, `app/people/new/page.tsx` (or shared form) — render typed inputs.
- `app/settings/custom-fields/page.tsx` — new settings page.
- `components/customFields/*` — settings list, template form, person-form section, filter dropdown / chip.
- `locales/{en,es-ES,de-DE,ja-JP,nb-NO,zh-CN}.json` — full `customFields` namespace.
- `tests/...` — coverage as above.
