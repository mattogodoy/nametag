# CardDAV Feature Branch Pre-Merge Review

**Date**: 2026-02-18
**Branch**: `feature/carddav-support` -> `master`
**Scope**: 144 files changed, ~27,000 lines added, 65 commits

## Review Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| IMPORTANT | 30 |
| MINOR | 30+ |

---

## CRITICAL Findings

### C1. `Person.uid` unique constraint is global, not per-user
- **File**: `prisma/schema.prisma:76`
- **Risk**: Two users importing contacts from different CardDAV servers can have UIDs that collide. The global `@unique` constraint causes a database error when the second user tries to import.
- **Action**: Change to `@@unique([userId, uid])` and create a migration.

### C2. No protection against overlapping sync runs
- **File**: `app/api/cron/carddav-sync/route.ts`
- **Risk**: If the cron job takes longer than the cron interval, a second invocation starts while the first is running. Both sync the same users simultaneously, causing duplicate vCard creation, race conditions on mappings/etags, and duplicate conflict records.
- **Action**: Implement a per-user lock (database-based advisory lock or update `lastSyncAt` at START of sync). Also guard against concurrent manual + cron sync.

### C3. `auto-export.ts` lacks retry logic on CardDAV network calls
- **File**: `lib/carddav/auto-export.ts:95, 234`
- **Risk**: Both `autoExportPerson()` and `autoUpdatePerson()` make CardDAV network calls without `withRetry`. Every other file uses `withRetry`. Since auto-export is fire-and-forget, transient failures silently fail.
- **Action**: Wrap CardDAV calls in `withRetry()`.

### C4. Duplicate ImportSuccessToast components
- **Files**: `components/ImportSuccessToast.tsx` (59 lines), `components/carddav/ImportSuccessToast.tsx` (51 lines)
- **Risk**: Both are actively used from different pages with slightly different behavior. Divergence risk.
- **Action**: Merge into a single configurable component.

### C5. Hardcoded English error strings break i18n
- **Files**: `DeletePersonButton.tsx:87,91`, `BulkExportList.tsx:93,106`, `ConflictList.tsx:95,100`, `ImportContactsList.tsx:137,152`, `AccountManagement.tsx:338`
- **Risk**: Error messages display in English regardless of user locale, violating project i18n requirements.
- **Action**: Replace all hardcoded strings with `t()` translation calls and add keys to all locale files.

---

## IMPORTANT Findings

### Data Safety

**I1. Non-atomic conflict resolution ("keep_remote")**
- `app/api/carddav/conflicts/[id]/resolve/route.ts:96-183`
- Deletes all multi-value fields in transaction, then updates person in a separate operation. If update fails, person loses all phone/email/address data.
- Action: Wrap all operations in a single `prisma.$transaction()`.

**I2. Connection DELETE lacks transaction for cascading deletes**
- `app/api/carddav/connection/route.ts:212-226`
- Three separate delete operations; if connection delete fails, mappings/imports are already gone.
- Action: Use `prisma.$transaction()`.

**I3. Import creates person + mapping without transactional safety**
- `app/api/carddav/import/route.ts:211-283`
- If mapping creation fails after person creation, orphaned person without sync link.
- Action: Wrap person + mapping creation in transaction.

**I4. `updatePersonFromVCard` drops importantDates during sync**
- `lib/carddav/sync.ts:657-725`
- Birthday/anniversary changes on the server never propagate to Nametag.
- Action: Add `importantDates` to the delete-and-recreate cycle.

**I5. `syncToServer` sends empty importantDates/groups to server**
- `lib/carddav/sync.ts:424-429`
- Hardcoded empty arrays instead of loading actual data from DB. Server loses birthday/category data.
- Action: Include these relations in the Prisma query.

**I6. Hard-deleting CardDavMapping when soft-deleting Person**
- `app/api/people/[id]/route.ts:386-402`
- If person is later restored, CardDAV mapping is permanently lost.
- Action: Soft-delete the mapping, or document as intentional.

**I7. `withDeleted()` creates new PrismaClient per import request**
- `app/api/carddav/import/route.ts:77-89`
- Concurrent imports can exhaust PostgreSQL connection pool. No try/finally for disconnect.
- Action: Use singleton pattern or restructure to avoid creating new clients.

### Security

**I8. SSRF risk in backup and connection test endpoints**
- `app/api/carddav/backup/route.ts:13-14`, `app/api/carddav/connection/test/route.ts:13-14`
- Authenticated users can make the server connect to arbitrary URLs, probing internal network.
- Action: Validate `serverUrl` against private IP ranges and restrict to HTTP/HTTPS.

**I9. No input sanitization on vCard imported data**
- `app/api/carddav/import/route.ts:99`, `app/api/vcard/import/route.ts:43`
- Imported names/notes bypass `sanitizeName()`/`sanitizeNotes()` that normal API routes apply.
- Action: Apply same sanitization to vCard-imported data.

**I10. Shared hardcoded connection ID for file uploads**
- `app/api/vcard/upload/route.ts:30-48`
- UUID `00000000-...0001` shared across users; multi-tenant issues.
- Action: Create per-user file import connections.

### Validation

**I11. No Zod validation on backup, connection test, import, and export-bulk endpoints**
- Multiple files use manual truthiness checks instead of Zod schemas.
- Action: Define Zod schemas for all input validation.

### Performance

**I12. N+1 query patterns in import and export routes**
- `app/api/carddav/import/route.ts:96-335` (~6 queries per contact)
- `app/api/carddav/export-bulk/route.ts:107-173` (mapping check per person)
- Action: Pre-fetch all mappings and existing persons before the loop.

**I13. `syncToServer` fetches ALL mappings with full includes, skips most**
- `lib/carddav/sync.ts:380-398`
- Loads all related data for potentially thousands of contacts only to skip unchanged ones.
- Action: Filter query to only pending/changed mappings.

**I14. `GET /api/people` always loads 7 multi-value relations**
- `app/api/people/route.ts:35-74`
- Even for list views that only need names. 500 contacts = 3500+ extra rows.
- Action: Make multi-value includes conditional via query parameter.

**I15. Full address book fetch instead of incremental sync**
- `lib/carddav/sync.ts:88-92`
- `syncToken` field exists but is never used for WebDAV `REPORT` requests.
- Action: Implement sync-token-based incremental fetch.

**I16. `syncToServer` exports all unmapped persons with no batching/rate limiting**
- `lib/carddav/sync.ts:509-598`
- Could overwhelm CardDAV server (especially Google) on first sync.
- Action: Add batch size limit with delay between batches.

**I17. No overall sync timeout**
- `lib/carddav/sync.ts`, `app/api/cron/carddav-sync/route.ts`
- Slow server blocks entire cron queue.
- Action: Add AbortController with timeout.

### Duplication

**I18. Duplicate vCard-to-person-create pattern across 4+ files**
- `app/api/carddav/import/route.ts`, `app/api/vcard/import/route.ts`, `app/api/carddav/conflicts/[id]/resolve/route.ts`, `lib/carddav/sync.ts`
- Nearly identical person creation/update from parsed vCard data.
- Action: Extract shared `createPersonFromVCardData()` / `updatePersonFromVCardData()`.

**I19. Duplicate local data hashing logic**
- `lib/carddav/auto-export.ts:98-111,237-250` vs `lib/carddav/sync.ts:481-496`
- Inconsistent hash inputs (one includes importantDates, others don't).
- Action: Extract shared `buildLocalHash(person)` utility.

**I20. Person*Manager components (Phone/Email/URL) share ~400 lines of identical patterns**
- `components/PersonPhoneManager.tsx`, `PersonEmailManager.tsx`, `PersonUrlManager.tsx`
- Same state, handlers, and UI layout with different field names.
- Action: Extract shared `MultiValueFieldManager<T>` or `useMultiValueField` hook.

**I21. `CardDavConnection` interface defined in 4 separate files**
- `ConnectionModal.tsx`, `ConnectionStatus.tsx`, `SyncSettingsModal.tsx`, `CardDavSettings.tsx`
- Action: Single canonical type in `lib/carddav/types.ts`, use `Pick<>` where needed.

### UI / UX

**I22. Import success color check uses English string match**
- `components/AccountManagement.tsx:770-775`
- `importMessage.includes('Success')` fails when locale is Spanish.
- Action: Use separate `importStatus` state variable.

**I23. Wrong translation key for delete account error**
- `components/AccountManagement.tsx:399,406`
- Uses `t('importFailed')` instead of `t('deleteAccountFailed')`.
- Action: Fix translation key.

**I24. `console.log` with payload data in PersonForm**
- `components/PersonForm.tsx:301`
- Logs potentially sensitive data (phone numbers, notes) in all environments.
- Action: Remove or gate behind development check.

**I25. Inconsistent error response format across CardDAV routes**
- Mix of `NextResponse.json()`, `new Response()`, and `{ success: false }` patterns.
- Action: Standardize on `apiResponse` helpers from `lib/api-utils.ts`.

**I26. vCard parsing on every render in ImportContactsList**
- `components/ImportContactsList.tsx:211-213`
- `parseVCard()` called inside `.map()` during render.
- Action: Use `useMemo` to pre-compute parsed data.

**I27. BulkExportList progress bar shows 0% then jumps to complete**
- `components/BulkExportList.tsx:79-110`
- No intermediate progress updates.
- Action: Replace with indeterminate loading indicator, or implement streaming progress.

### Accessibility

**I28. TypeComboBox missing ARIA combobox pattern**
- `components/TypeComboBox.tsx`
- Missing `role="combobox"`, `aria-expanded`, `aria-controls`, keyboard navigation.
- Action: Implement WAI-ARIA combobox pattern.

**I29. PersonVCardExport QR modal bypasses shared Modal component**
- `components/PersonVCardExport.tsx:145-196`
- Raw `<div>` overlay without `role="dialog"`, focus trapping, scroll prevention.
- Action: Refactor to use shared `Modal` component.

### Test Coverage

**I30. No tests for 6 core library files and 9 API routes**
- Untested: `auto-export.ts`, `client.ts`, `delete-contact.ts`, `discover.ts`, `encryption.ts`, `retry.ts`
- No API route tests for any CardDAV endpoint
- Action: Add unit tests for library files, at minimum for encryption (security-critical) and retry logic.

---

## Cleanup Items

### Files to Remove
1. `check-users.ts` - Debug script
2. `locales/no.json.tmp` - Empty temp file
3. `docs/plans/2026-02-16-sync-progress-sse-design.md` - Design doc
4. `docs/plans/2026-02-16-sync-progress-sse.md` - Implementation plan
5. `app/settings/vcard-test/` directory - Dev-only test page (+ remove `vcardTest` translation keys from all locale files)

### Debug Artifacts
1. `console.log` in `lib/carddav/auto-export.ts:126,262`
2. `console.log` in `lib/carddav/delete-contact.ts:29,58`
3. `console.log` in `components/PersonForm.tsx:301`
4. Replace with project logger (`lib/logger.ts`)

### Dead Code
1. Unused `addressBook` variable + `fetchAddressBooks()` call in `lib/carddav/delete-contact.ts:40-47`
2. Unused `VCardOptions` interface in `lib/carddav/types.ts:123-128`
3. Cron status ternary always evaluates to `'completed'`: `app/api/cron/carddav-sync/route.ts:133`

### Minor Code Quality
1. Array index used as React key in all Person*Manager components
2. Mixed `withAuth` wrapper vs manual auth checks across routes
3. `normalizeUrl` function duplicated between ConnectionModal and wizard Step1
4. Unused imports in `vcard-v3-compliance.test.ts`
5. `updatePersonFromVCard` missing `secondLastName` and `lastContact` fields

### Database
1. Squash 3 migrations into 1 before deploying to production
2. `autoSyncInterval` default mismatch: migration says 300, schema says 43200
3. Consider removing `middleName` and `secondLastName` indexes if rarely queried

---

## Priority Order for Fixes

### Phase 1: Critical (must fix before merge)
- C1: Fix UID unique constraint (schema + migration)
- C2: Add sync locking mechanism
- C3: Add retry logic to auto-export
- C4: Merge duplicate ImportSuccessToast
- C5: Fix hardcoded English strings

### Phase 2: Data Safety (should fix before merge)
- I1-I3: Add transactions for conflict resolution, connection delete, import
- I4-I5: Fix importantDates/groups in sync engine
- I8-I10: SSRF validation, input sanitization, file upload connection

### Phase 3: Quality (fix before or shortly after merge)
- I11: Add Zod validation to all routes
- I18-I21: Deduplicate code patterns
- I22-I25: Fix UI bugs (wrong translation keys, error format)
- Cleanup items (remove files, debug logs, dead code)

### Phase 4: Performance (can fix after merge)
- I12-I17: N+1 queries, incremental sync, batching, timeouts
- I26-I27: Render performance, progress indicators

### Phase 5: Tests & Accessibility (can fix after merge)
- I28-I29: ARIA patterns
- I30: Test coverage for untested files
