# Merge Duplicate Contacts — Design

## Problem

Users can end up with multiple contacts referring to the same person. Manually merging them is tedious — you have to compare fields, move relationships, reassign groups, and clean up the leftover contact.

## Goals

- Detect potential duplicate contacts using fuzzy name matching
- Provide a merge flow: pick a primary contact, auto-fill missing fields, choose between conflicting scalar fields, union multi-value fields
- Soft-delete the merged-away contact after transferring all data
- Keep it simple

## Duplicate Detection

**Algorithm**: Server-side Levenshtein distance on combined `name + surname` fields. A utility function `levenshteinSimilarity(a, b)` returns a 0–1 score. Candidates above a 0.75 threshold are returned.

**API endpoints**:
- `GET /api/people/[id]/duplicates` — returns candidates for a specific person, sorted by similarity (descending)
- `GET /api/people/duplicates` — global scan, returns all duplicate pairs grouped together

**Performance**: Compares all pairs in memory. Fine for personal-scale data (sub-second for <1000 contacts). If this ever becomes a bottleneck, migrate to PostgreSQL `pg_trgm`.

## Merge API

**Endpoint**: `POST /api/people/merge`

**Body**:
```json
{
  "primaryId": "uuid",
  "secondaryId": "uuid",
  "fieldOverrides": {
    "nickname": "Bobby"
  }
}
```

`fieldOverrides` is optional. Keys are scalar field names; values are the chosen value (from the secondary) that should override the primary's value. Fields not in `fieldOverrides` keep the primary's value.

**Transaction steps** (single `prisma.$transaction`):

1. **Scalar fields**: Apply `fieldOverrides` to the primary contact
2. **Multi-value fields**: Re-parent all phones, emails, addresses, URLs, IMs, locations, custom fields, and important dates from secondary to primary (update `personId`). Deduplicate exact matches (same phone number, same email, etc.)
3. **Groups**: Add primary to any groups the secondary belongs to (skip if already a member)
4. **Relationships**: Transfer secondary's relationships to primary. If both have a relationship to the same person, keep the primary's
5. **CardDAV mapping**: If secondary has a mapping, delete the remote vCard (background, non-blocking) and delete the mapping. Primary keeps its mapping
6. **Soft-delete** the secondary contact

## UI Flow

### Entry Points

1. **Person detail page**: "Find Duplicates" button. Calls the per-person duplicates endpoint. Shows candidates with similarity scores.
2. **Global duplicates page** (`/people/duplicates`): Accessible from the people list toolbar. Calls the global duplicates endpoint. Shows all duplicate pairs.

### Merge Screen (`/people/merge?primary=X&secondary=Y`)

1. **Pick primary**: Both contacts shown side-by-side. Radio toggle to select which survives. Defaults to the one with more data.
2. **Review conflicts**: For scalar fields where both have different non-empty values, show a radio picker per field (primary pre-selected). Multi-value fields show a note: "X phones, Y emails will be combined."
3. **Confirm & merge**: Summary of actions, "Merge" button. On success, redirect to the surviving contact's detail page.

## Component Architecture

**New components**:
- `PersonCompare` — general-purpose side-by-side Person comparison with field-level selection. Designed for reuse (can later replace CardDAV `ConflictList`)
- `DuplicatesList` — renders duplicate candidates with similarity scores and "Merge" action
- `MergeConfirmation` — summary of merge actions with confirm/cancel

**New pages**:
- `/people/duplicates` — global duplicate scanner
- `/people/merge` — merge flow

**Modified pages**:
- Person detail page — add "Find Duplicates" button
- People list page — add "Find Duplicates" button in toolbar

## Edge Cases

- **Both contacts have CardDAV mappings**: Keep primary's. Delete secondary's remote vCard (best-effort, non-blocking). Log failures but don't block merge.
- **Self-merge**: API rejects `primaryId === secondaryId`.
- **Relationship to user**: If both have `relationshipToUser`, keep primary's.
- **Duplicate multi-value entries**: After union, deduplicate exact matches (same phone number, same email address, etc.).
- **Deleted contact**: API rejects if either contact has `deletedAt` set.

## Translations

All new UI strings must be added to all five locale files:
- `locales/en.json`
- `locales/es-ES.json`
- `locales/de-DE.json`
- `locales/ja-JP.json`
- `locales/nb-NO.json`

Namespaces: `people.duplicates` (detection UI), `people.merge` (merge flow).

## Future Work (Not In Scope)

- Nickname/diminutive awareness (Matt → Matthew)
- Phone/email-based duplicate detection
- Bulk merge (merge 3+ contacts at once)
- Refactor CardDAV ConflictList to use new PersonCompare component
