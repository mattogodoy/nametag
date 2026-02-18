# CardDAV Pre-Merge Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical, data safety, quality, performance, and test coverage issues identified in the CardDAV review before merging to master.

**Architecture:** Incremental fixes organized into 5 phases, each with atomic commits. All changes are backwards-compatible. Database migrations are additive. TDD for new logic.

**Tech Stack:** Next.js, TypeScript, Prisma, PostgreSQL, Vitest, tsdav

**Reference:** See `docs/plans/2026-02-18-carddav-review-design.md` for the full review findings.

---

## Phase 1: Critical Fixes (must fix before merge)

### Task 1: Fix UID unique constraint to be per-user

**Files:**
- Modify: `prisma/schema.prisma:76` (remove `@unique`, add `@@unique`)
- Create: new migration via `npx prisma migrate dev`

**Step 1: Update schema**

In `prisma/schema.prisma`, change:
```
uid  String?  @unique // Required for sync
```
to:
```
uid  String?  // Required for sync
```

And add a compound unique index at the bottom of the Person model block (before `@@map("people")`):
```
@@unique([userId, uid])
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name fix_uid_unique_per_user`
Expected: Migration created, `prisma generate` runs, client updated.

**Step 3: Run tests**

Run: `npm test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "fix: scope Person.uid unique constraint to per-user"
```

---

### Task 2: Add sync locking to prevent concurrent sync runs

**Files:**
- Modify: `prisma/schema.prisma` (add `syncInProgress` and `syncStartedAt` to `CardDavConnection`)
- Create: new migration
- Modify: `app/api/cron/carddav-sync/route.ts` (add lock acquisition)
- Modify: `lib/carddav/sync.ts` (add lock acquisition to `bidirectionalSync`)
- Modify: `app/api/carddav/sync/route.ts` (add lock check)

**Step 1: Add lock fields to schema**

In `prisma/schema.prisma`, add to the `CardDavConnection` model:
```prisma
syncInProgress  Boolean   @default(false)
syncStartedAt   DateTime?
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_sync_lock_fields`

**Step 3: Add lock acquisition helper**

Create a helper function in `lib/carddav/sync.ts` (add near the top, after imports):

```typescript
/**
 * Acquire a sync lock for a user. Returns true if lock was acquired.
 * Uses optimistic locking: only updates if syncInProgress is false.
 */
async function acquireSyncLock(userId: string): Promise<boolean> {
  const staleThreshold = 10 * 60 * 1000; // 10 minutes
  const now = new Date();

  // Try to acquire lock, breaking stale locks older than threshold
  const result = await prisma.cardDavConnection.updateMany({
    where: {
      userId,
      OR: [
        { syncInProgress: false },
        { syncStartedAt: { lt: new Date(now.getTime() - staleThreshold) } },
      ],
    },
    data: {
      syncInProgress: true,
      syncStartedAt: now,
    },
  });

  return result.count > 0;
}

async function releaseSyncLock(userId: string): Promise<void> {
  await prisma.cardDavConnection.updateMany({
    where: { userId },
    data: {
      syncInProgress: false,
      syncStartedAt: null,
    },
  });
}
```

**Step 4: Use lock in bidirectionalSync**

In `lib/carddav/sync.ts`, wrap `bidirectionalSync` with lock acquisition. At the start of the function, before the try block:

```typescript
const lockAcquired = await acquireSyncLock(userId);
if (!lockAcquired) {
  return {
    imported: 0, exported: 0, updatedLocally: 0, updatedRemotely: 0,
    conflicts: 0, errors: 0, pendingImports: 0,
  };
}
```

And wrap the entire function body in try/finally with `releaseSyncLock(userId)` in the finally block.

**Step 5: Fix cron status ternary**

In `app/api/cron/carddav-sync/route.ts:133`, change:
```
status: errorCount > 0 ? 'completed' : 'completed',
```
to:
```
status: errorCount > 0 ? 'completed_with_errors' : 'completed',
```

**Step 6: Run tests**

Run: `npm test`

**Step 7: Commit**

```bash
git add prisma/ lib/carddav/sync.ts app/api/cron/carddav-sync/route.ts app/api/carddav/sync/route.ts
git commit -m "fix: add sync locking to prevent concurrent sync runs"
```

---

### Task 3: Add retry logic to auto-export

**Files:**
- Modify: `lib/carddav/auto-export.ts`

**Step 1: Add withRetry import**

At the top of `lib/carddav/auto-export.ts`, add to imports:
```typescript
import { withRetry } from './retry';
```

**Step 2: Wrap createVCard call**

Around line 95, change:
```typescript
const created = await client.createVCard(addressBook, vCardData, filename);
```
to:
```typescript
const created = await withRetry(() => client.createVCard(addressBook, vCardData, filename));
```

**Step 3: Wrap updateVCard call**

Around line 234 (the `autoUpdatePerson` function), find the `client.updateVCard` call and wrap it similarly:
```typescript
const updated = await withRetry(() => client.updateVCard(/* existing args */));
```

**Step 4: Replace console.log with logger**

Replace `console.log` at lines 126 and 262 with:
```typescript
logger.info('Auto-exported person to CardDAV', { personId: person.id });
```
And `console.error` calls with `logger.error(...)`. Add import for `logger` from `@/lib/logger`.

**Step 5: Run tests**

Run: `npm test`

**Step 6: Commit**

```bash
git add lib/carddav/auto-export.ts
git commit -m "fix: add retry logic and proper logging to auto-export"
```

---

### Task 4: Merge duplicate ImportSuccessToast components

**Files:**
- Modify: `components/ImportSuccessToast.tsx` (make configurable)
- Delete: `components/carddav/ImportSuccessToast.tsx`
- Modify: `app/settings/carddav/CardDavSettings.tsx` (update import)
- Modify: `tests/components/ImportSuccessToast.test.tsx` (update if needed)

**Step 1: Make the root component configurable**

Rewrite `components/ImportSuccessToast.tsx` to accept optional props:

```typescript
interface ImportSuccessToastProps {
  redirectPath?: string;
  errorLevel?: 'error' | 'warning';
}

export default function ImportSuccessToast({
  redirectPath,
  errorLevel = 'error',
}: ImportSuccessToastProps = {}) {
```

- When `redirectPath` is provided, use `router.replace(redirectPath, { scroll: false })`
- When not provided, use the existing URL cleanup logic
- Use `errorLevel` to choose between `toast.error` and `toast.warning`
- Keep the `importedCount > 0` guard for success toasts

**Step 2: Delete the carddav version**

Remove `components/carddav/ImportSuccessToast.tsx`.

**Step 3: Update import in CardDavSettings**

In `app/settings/carddav/CardDavSettings.tsx`, change:
```typescript
import ImportSuccessToast from '@/components/carddav/ImportSuccessToast';
```
to:
```typescript
import ImportSuccessToast from '@/components/ImportSuccessToast';
```
And update the usage:
```tsx
<ImportSuccessToast redirectPath="/settings/carddav" errorLevel="warning" />
```

**Step 4: Run tests**

Run: `npm test`

**Step 5: Commit**

```bash
git add components/ImportSuccessToast.tsx app/settings/carddav/CardDavSettings.tsx
git rm components/carddav/ImportSuccessToast.tsx
git commit -m "fix: merge duplicate ImportSuccessToast into single configurable component"
```

---

### Task 5: Fix hardcoded English error strings

**Files:**
- Modify: `components/DeletePersonButton.tsx` (lines 87, 91)
- Modify: `components/BulkExportList.tsx` (lines 93, 106)
- Modify: `components/ConflictList.tsx` (lines 95, 100)
- Modify: `components/ImportContactsList.tsx` (lines 137, 152)
- Modify: `components/AccountManagement.tsx` (lines 338, 399, 406)
- Modify: `locales/en.json`
- Modify: `locales/es-ES.json`
- Modify: `locales/de-DE.json`
- Modify: `locales/ja-JP.json`
- Modify: `locales/nb-NO.json`

**Step 1: Add translation keys to all locale files**

Add under `common` or the relevant namespace in each locale:
```json
"errors": {
  "deleteFailed": "Failed to delete. Please try again.",
  "connectionError": "Unable to connect to server. Please check your connection.",
  "exportFailed": "Failed to export contacts",
  "importFailed": "Failed to import contacts",
  "resolveFailed": "Failed to resolve conflict",
  "deleteAccountFailed": "Failed to delete account"
}
```

Add corresponding translations in es-ES, de-DE, ja-JP, and nb-NO.

**Step 2: Replace hardcoded strings in each component**

In each component, replace the hardcoded English string with `t('errors.KEY')` using the appropriate translation hook.

**Step 3: Fix AccountManagement wrong translation key**

In `components/AccountManagement.tsx:399,406`, replace `t('importFailed')` with `t('errors.deleteAccountFailed')`.

**Step 4: Fix AccountManagement success check**

Around line 770-775, replace `importMessage.includes('Success')` with a separate state variable:
```typescript
const [importStatus, setImportStatus] = useState<'success' | 'error' | null>(null);
```
Use `importStatus === 'success'` for the color condition.

**Step 5: Run tests**

Run: `npm test`

**Step 6: Commit**

```bash
git add components/DeletePersonButton.tsx components/BulkExportList.tsx components/ConflictList.tsx components/ImportContactsList.tsx components/AccountManagement.tsx locales/
git commit -m "fix: replace hardcoded English error strings with i18n translation keys"
```

---

## Phase 2: Data Safety Fixes

### Task 6: Add transactions to conflict resolution, connection delete, and import

**Files:**
- Modify: `app/api/carddav/conflicts/[id]/resolve/route.ts` (wrap in transaction)
- Modify: `app/api/carddav/connection/route.ts` (wrap DELETE in transaction)
- Modify: `app/api/carddav/import/route.ts` (wrap per-contact ops in transaction, fix withDeleted leak)

**Step 1: Fix conflict resolution atomicity**

In `app/api/carddav/conflicts/[id]/resolve/route.ts`, wrap the "keep_remote" resolution (lines 96-183) in `prisma.$transaction(async (tx) => { ... })` using the interactive transaction API. Replace all `prisma.` calls within the block with `tx.`.

**Step 2: Fix connection DELETE atomicity**

In `app/api/carddav/connection/route.ts` (lines 212-226), wrap the three deletes in a single `prisma.$transaction([...])`.

**Step 3: Fix import withDeleted leak**

In `app/api/carddav/import/route.ts`, wrap the `withDeleted()` call in try/finally:
```typescript
const rawClient = withDeleted();
try {
  // ... existing code
} finally {
  await rawClient.$disconnect();
}
```

**Step 4: Run tests, commit**

```bash
git add app/api/carddav/conflicts/ app/api/carddav/connection/ app/api/carddav/import/
git commit -m "fix: add transactional safety to conflict resolution, connection delete, and import"
```

---

### Task 7: Fix sync engine to handle importantDates and groups

**Files:**
- Modify: `lib/carddav/sync.ts`

**Step 1: Fix updatePersonFromVCard to handle importantDates**

In `lib/carddav/sync.ts`, in the `updatePersonFromVCard` function (line 662), add `importantDates` deletion to the transaction:
```typescript
prisma.importantDate.deleteMany({ where: { personId, deletedAt: null } }),
```

And add importantDates creation in the person update:
```typescript
importantDates: parsedData.importantDates?.length
  ? { create: parsedData.importantDates }
  : undefined,
```

Also add `secondLastName` and `lastContact` to the update data.

**Step 2: Fix syncToServer to include importantDates and groups**

In the Prisma query for mapped contacts (line 380-398), add to the `person.include`:
```typescript
importantDates: { where: { deletedAt: null } },
groups: { include: { group: true } },
relationshipsFrom: { where: { deletedAt: null }, include: { relatedPerson: true } },
```

Then remove the hardcoded empty arrays (lines 424-429) and use the actual data.

**Step 3: Run tests, commit**

```bash
git add lib/carddav/sync.ts
git commit -m "fix: sync importantDates, groups, and missing fields bidirectionally"
```

---

### Task 8: Add SSRF protection and input sanitization

**Files:**
- Create: `lib/carddav/url-validation.ts`
- Modify: `app/api/carddav/backup/route.ts`
- Modify: `app/api/carddav/connection/test/route.ts`
- Modify: `app/api/carddav/connection/route.ts`
- Modify: `app/api/carddav/import/route.ts`
- Modify: `app/api/vcard/import/route.ts`
- Create: `tests/lib/carddav/url-validation.test.ts`

**Step 1: Write failing tests for URL validation**

Create `tests/lib/carddav/url-validation.test.ts`:
```typescript
import { validateServerUrl } from '@/lib/carddav/url-validation';

describe('validateServerUrl', () => {
  it('allows HTTPS URLs', () => {
    expect(() => validateServerUrl('https://contacts.google.com')).not.toThrow();
  });
  it('rejects private IPs', () => {
    expect(() => validateServerUrl('https://192.168.1.1')).toThrow();
    expect(() => validateServerUrl('https://10.0.0.1')).toThrow();
    expect(() => validateServerUrl('https://127.0.0.1')).toThrow();
  });
  it('rejects non-HTTP protocols', () => {
    expect(() => validateServerUrl('ftp://example.com')).toThrow();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/lib/carddav/url-validation.test.ts`

**Step 3: Implement URL validation**

Create `lib/carddav/url-validation.ts` with a `validateServerUrl(url: string)` function that rejects private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, ::1, localhost) and non-HTTP/HTTPS protocols.

**Step 4: Run tests to verify they pass**

**Step 5: Add sanitization to import routes**

Import `sanitizeName` and `sanitizeNotes` from `lib/validations.ts` in both import routes and apply to parsed vCard data before persisting.

**Step 6: Add URL validation to backup and test endpoints**

Call `validateServerUrl(serverUrl)` before making any outbound connections.

**Step 7: Run full test suite, commit**

```bash
git add lib/carddav/url-validation.ts tests/lib/carddav/url-validation.test.ts app/api/carddav/ app/api/vcard/
git commit -m "fix: add SSRF protection and input sanitization for CardDAV imports"
```

---

## Phase 3: Quality Improvements

### Task 9: Add Zod validation to CardDAV API routes

**Files:**
- Modify: `app/api/carddav/backup/route.ts`
- Modify: `app/api/carddav/connection/test/route.ts`
- Modify: `app/api/carddav/import/route.ts`
- Modify: `app/api/carddav/export-bulk/route.ts`

**Step 1: Add Zod schemas to each route**

Define schemas like:
```typescript
const backupSchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});
```

Replace manual validation with `schema.parse(body)`.

**Step 2: Run tests, commit**

```bash
git add app/api/carddav/
git commit -m "refactor: add Zod validation to all CardDAV API routes"
```

---

### Task 10: Extract shared vCard-to-person helper

**Files:**
- Create: `lib/carddav/person-from-vcard.ts`
- Modify: `app/api/carddav/import/route.ts`
- Modify: `app/api/vcard/import/route.ts`
- Modify: `app/api/carddav/conflicts/[id]/resolve/route.ts`
- Modify: `lib/carddav/sync.ts`

**Step 1: Extract the helper**

Move `updatePersonFromVCard` from `lib/carddav/sync.ts` to a new file `lib/carddav/person-from-vcard.ts`. Export it. Also create a `createPersonFromVCardData` function that encapsulates the person creation pattern duplicated across import routes.

**Step 2: Update all consumers**

Replace duplicated person creation/update code in all 4 files with calls to the shared helpers.

**Step 3: Run tests, commit**

```bash
git add lib/carddav/person-from-vcard.ts lib/carddav/sync.ts app/api/carddav/ app/api/vcard/
git commit -m "refactor: extract shared vCard-to-person helpers to eliminate duplication"
```

---

### Task 11: Extract shared local data hashing utility

**Files:**
- Create: `lib/carddav/hash.ts`
- Modify: `lib/carddav/auto-export.ts`
- Modify: `lib/carddav/sync.ts`

**Step 1: Extract buildLocalHash**

Create `lib/carddav/hash.ts` with a `buildLocalHash(person)` function that consistently defines which fields contribute to the hash. Include importantDates and groups.

**Step 2: Replace inline hashing in auto-export.ts and sync.ts**

**Step 3: Run tests, commit**

```bash
git add lib/carddav/hash.ts lib/carddav/auto-export.ts lib/carddav/sync.ts
git commit -m "refactor: extract shared local data hashing utility for consistent change detection"
```

---

### Task 12: Consolidate CardDavConnection type

**Files:**
- Modify: `lib/carddav/types.ts` (add canonical type)
- Modify: `components/carddav/ConnectionModal.tsx`
- Modify: `components/carddav/ConnectionStatus.tsx`
- Modify: `components/carddav/SyncSettingsModal.tsx`
- Modify: `app/settings/carddav/CardDavSettings.tsx`

**Step 1: Define canonical type in types.ts**

Add a full `CardDavConnectionResponse` type (the shape returned from the API, without password). Remove the unused `VCardOptions` interface.

**Step 2: Replace local interfaces in all 4 component files with imports from types.ts**

Use `Pick<CardDavConnectionResponse, 'field1' | 'field2'>` where only a subset is needed.

**Step 3: Run tests, commit**

```bash
git add lib/carddav/types.ts components/carddav/ app/settings/carddav/
git commit -m "refactor: consolidate CardDavConnection type definitions"
```

---

### Task 13: Fix remaining UI bugs and cleanup

**Files:**
- Modify: `components/PersonForm.tsx` (remove console.log at line 301)
- Modify: `lib/carddav/delete-contact.ts` (remove unused addressBook, replace console.log with logger)
- Modify: `app/api/cron/carddav-sync/route.ts` (already done in Task 2)
- Remove: `check-users.ts`
- Remove: `locales/no.json.tmp`
- Remove: `docs/plans/2026-02-16-sync-progress-sse-design.md`
- Remove: `docs/plans/2026-02-16-sync-progress-sse.md`
- Remove: `app/settings/vcard-test/` directory
- Modify: locale files to remove `vcardTest` translation keys

**Step 1: Remove console.log from PersonForm**

Delete line 301: `console.log('Sending payload:', payload);`

**Step 2: Clean up delete-contact.ts**

Remove the `fetchAddressBooks()` call and unused `addressBook` variable (lines 40-47). Replace `console.log` with logger calls.

**Step 3: Remove temp/debug files**

```bash
git rm check-users.ts locales/no.json.tmp
git rm docs/plans/2026-02-16-sync-progress-sse-design.md docs/plans/2026-02-16-sync-progress-sse.md
git rm -r app/settings/vcard-test/
```

**Step 4: Remove vcardTest translation keys from all 5 locale files**

Remove the `vcardTest` section from each locale file.

**Step 5: Run tests, commit**

```bash
git add -A
git commit -m "chore: remove debug artifacts, temp files, and dev-only vCard test page"
```

---

## Phase 4: Performance Improvements

### Task 14: Optimize sync query patterns

**Files:**
- Modify: `lib/carddav/sync.ts`
- Modify: `app/api/carddav/import/route.ts`
- Modify: `app/api/carddav/export-bulk/route.ts`

**Step 1: Fix syncToServer to only fetch changed mappings**

Change the query at line 380-398 to filter by `syncStatus: 'pending'` only, or add a `lastLocalChange > lastSyncedAt` condition. This avoids loading all synced mappings.

**Step 2: Pre-fetch mappings in import route**

Before the import loop, fetch all existing mappings for the connection in a single query:
```typescript
const existingMappings = await prisma.cardDavMapping.findMany({
  where: { connectionId: connection.id },
  select: { uid: true, personId: true },
});
const mappingsByUid = new Map(existingMappings.map(m => [m.uid, m]));
```
Then use `mappingsByUid.get(uid)` instead of individual `findFirst` calls per contact.

**Step 3: Pre-fetch mappings in export-bulk route**

Before the export loop, fetch all existing mappings for the personIds:
```typescript
const existingMappings = await prisma.cardDavMapping.findMany({
  where: { personId: { in: personIds } },
});
const mappingsByPersonId = new Map(existingMappings.map(m => [m.personId, m]));
```

**Step 4: Make GET /api/people multi-value includes conditional**

In `app/api/people/route.ts`, check for `includeContactInfo` query parameter. Only include phoneNumbers, emails, addresses, etc. when explicitly requested.

**Step 5: Run tests, commit**

```bash
git add lib/carddav/sync.ts app/api/carddav/ app/api/people/route.ts
git commit -m "perf: optimize sync and import queries to eliminate N+1 patterns"
```

---

### Task 15: Add batching and timeout to sync operations

**Files:**
- Modify: `lib/carddav/sync.ts`

**Step 1: Add batch export with delays**

In `syncToServer`, when exporting unmapped persons, process in batches of 50 with 100ms delay between batches.

**Step 2: Add overall sync timeout**

Add an `AbortController` with a configurable timeout (default 5 minutes) to `bidirectionalSync`. Pass the signal through to network operations where possible.

**Step 3: Run tests, commit**

```bash
git add lib/carddav/sync.ts
git commit -m "perf: add batching, rate limiting, and timeout to sync operations"
```

---

### Task 16: Fix render performance in ImportContactsList

**Files:**
- Modify: `components/ImportContactsList.tsx`
- Modify: `components/BulkExportList.tsx`

**Step 1: Memoize vCard parsing**

In `ImportContactsList.tsx`, add:
```typescript
const parsedVCards = useMemo(
  () => new Map(pendingImports.map(pi => [pi.id, parseVCard(pi.vCardData)])),
  [pendingImports]
);
```
Then use `parsedVCards.get(pi.id)` instead of inline `parseVCard()` calls.

**Step 2: Fix BulkExportList progress indicator**

Replace the misleading 0%-to-complete progress bar with an indeterminate loading spinner while the export is in progress.

**Step 3: Run tests, commit**

```bash
git add components/ImportContactsList.tsx components/BulkExportList.tsx
git commit -m "perf: memoize vCard parsing and fix export progress indicator"
```

---

## Phase 5: Tests & Accessibility

### Task 17: Add tests for encryption and retry modules

**Files:**
- Create: `tests/lib/carddav/encryption.test.ts`
- Create: `tests/lib/carddav/retry.test.ts`

**Step 1: Write encryption tests**

```typescript
describe('encryptPassword / decryptPassword', () => {
  it('round-trips correctly', () => {
    const password = 'my-secret-password';
    const encrypted = encryptPassword(password);
    expect(decryptPassword(encrypted)).toBe(password);
  });

  it('produces different ciphertext for same input (random IV)', () => {
    const a = encryptPassword('same');
    const b = encryptPassword('same');
    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', () => {
    const encrypted = encryptPassword('test');
    const tampered = encrypted.slice(0, -2) + 'xx';
    expect(() => decryptPassword(tampered)).toThrow();
  });

  it('throws on invalid format', () => {
    expect(() => decryptPassword('not:valid')).toThrow('Invalid encrypted password format');
  });
});
```

**Step 2: Write retry tests**

```typescript
describe('withRetry', () => {
  it('returns on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('fail'), { status: 500 }))
      .mockResolvedValue('ok');
    expect(await withRetry(fn, { initialDelay: 1 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValue(Object.assign(new Error('auth'), { status: 401 }));
    await expect(withRetry(fn)).rejects.toThrow('auth');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts', async () => {
    const fn = vi.fn()
      .mockRejectedValue(Object.assign(new Error('fail'), { status: 500 }));
    await expect(withRetry(fn, { maxAttempts: 3, initialDelay: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('categorizeError', () => {
  it('categorizes 401 as AUTH', () => {
    const result = categorizeError({ status: 401 });
    expect(result.category).toBe('auth');
  });

  it('categorizes 429 as RATE_LIMIT', () => {
    const result = categorizeError({ status: 429 });
    expect(result.category).toBe('rate_limit');
  });

  it('categorizes network errors as NETWORK', () => {
    const result = categorizeError(new Error('ECONNREFUSED'));
    expect(result.category).toBe('network');
  });
});
```

**Step 3: Run tests**

Run: `npm test -- tests/lib/carddav/encryption.test.ts tests/lib/carddav/retry.test.ts`

**Step 4: Commit**

```bash
git add tests/lib/carddav/encryption.test.ts tests/lib/carddav/retry.test.ts
git commit -m "test: add tests for encryption and retry modules"
```

---

### Task 18: Add tests for auto-export and delete-contact

**Files:**
- Create: `tests/lib/carddav/auto-export.test.ts`
- Create: `tests/lib/carddav/delete-contact.test.ts`

**Step 1: Write auto-export tests**

Test `autoExportPerson` with mocked Prisma and CardDAV client:
- Happy path: person exported, mapping created
- Person without UID: generates UUID
- Connection not found: logs error
- Auto-export disabled: returns early
- Already mapped: skips export

**Step 2: Write delete-contact tests**

Test `deleteFromCardDav` with mocked dependencies:
- Happy path: deletes vCard and mapping
- No mapping found: logs and returns
- CardDAV error: throws with proper error

**Step 3: Run tests, commit**

```bash
git add tests/lib/carddav/auto-export.test.ts tests/lib/carddav/delete-contact.test.ts
git commit -m "test: add tests for auto-export and delete-contact modules"
```

---

### Task 19: Fix TypeComboBox accessibility

**Files:**
- Modify: `components/TypeComboBox.tsx`
- Modify: `tests/components/TypeComboBox.test.tsx`

**Step 1: Add ARIA attributes**

- Add `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` to input
- Add `role="listbox"` to dropdown
- Add `role="option"` and `aria-selected` to option buttons
- Add `aria-label` to toggle button
- Add keyboard navigation (arrow keys to navigate options, Enter to select, Escape to close)

**Step 2: Update tests**

Update `TypeComboBox.test.tsx` to test ARIA attributes and keyboard navigation.

**Step 3: Run tests, commit**

```bash
git add components/TypeComboBox.tsx tests/components/TypeComboBox.test.tsx
git commit -m "fix: add ARIA combobox pattern to TypeComboBox for accessibility"
```

---

### Task 20: Fix QR modal to use shared Modal component

**Files:**
- Modify: `components/PersonVCardExport.tsx`

**Step 1: Replace raw div overlay with Modal component**

Import `Modal` from `@/components/ui/Modal` and replace the raw div overlay (lines 145-196) with:
```tsx
<Modal isOpen={showQr} onClose={() => setShowQr(false)} title={t('qrCodeTitle')}>
  {/* QR code content */}
</Modal>
```

**Step 2: Run tests, commit**

```bash
git add components/PersonVCardExport.tsx
git commit -m "fix: use shared Modal component for QR code overlay"
```

---

### Task 21: Final build verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass.

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Run linting**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 4: Final commit if any changes needed**

---

## Execution Checklist

| Phase | Task | Description | Status |
|-------|------|-------------|--------|
| 1 | 1 | Fix UID unique constraint | |
| 1 | 2 | Add sync locking | |
| 1 | 3 | Add retry to auto-export | |
| 1 | 4 | Merge ImportSuccessToast | |
| 1 | 5 | Fix hardcoded English strings | |
| 2 | 6 | Add transactions | |
| 2 | 7 | Fix sync importantDates/groups | |
| 2 | 8 | SSRF protection + sanitization | |
| 3 | 9 | Zod validation | |
| 3 | 10 | Extract vCard-to-person helper | |
| 3 | 11 | Extract hashing utility | |
| 3 | 12 | Consolidate types | |
| 3 | 13 | Cleanup files + debug artifacts | |
| 4 | 14 | Optimize query patterns | |
| 4 | 15 | Batching + timeout | |
| 4 | 16 | Render performance | |
| 5 | 17 | Encryption + retry tests | |
| 5 | 18 | Auto-export + delete tests | |
| 5 | 19 | TypeComboBox accessibility | |
| 5 | 20 | QR modal accessibility | |
| 5 | 21 | Final build verification | |
