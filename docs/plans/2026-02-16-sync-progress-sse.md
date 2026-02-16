# SSE Sync Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stream real-time per-contact progress updates from the CardDAV sync API to the UI using Server-Sent Events.

**Architecture:** Add an optional `onProgress` callback to the sync engine functions. The sync API route creates a `ReadableStream` and passes a callback that writes SSE events. The UI reads the stream and updates progress state in real time.

**Tech Stack:** Next.js API routes (ReadableStream), SSE (text/event-stream), React state, next-intl

---

### Task 1: Add progress callback to sync engine

**Files:**
- Modify: `lib/carddav/sync.ts`

**Step 1: Add the `SyncProgressEvent` type and callback type**

At the top of `lib/carddav/sync.ts`, after the `SyncResult` interface (line 19), add:

```typescript
export interface SyncProgressEvent {
  phase: 'pull' | 'push';
  step: 'connecting' | 'fetching' | 'processing';
  current?: number;
  total?: number;
  contact?: string;
}

export type SyncProgressCallback = (event: SyncProgressEvent) => void;
```

**Step 2: Add `onProgress` parameter to `syncFromServer`**

Change the function signature at line 33 from:

```typescript
export async function syncFromServer(
  userId: string
): Promise<SyncResult> {
```

to:

```typescript
export async function syncFromServer(
  userId: string,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
```

Then add progress calls at these points inside the function body:

After `const connection = await prisma.cardDavConnection.findUnique(...)` (after line 51, inside the `if (!connection)` check):
```typescript
    onProgress?.({ phase: 'pull', step: 'connecting' });
```

After `const client = await createCardDavClient(connection)` (after line 59):
```typescript
    onProgress?.({ phase: 'pull', step: 'fetching' });
```

Inside the `for (const vCard of vCards)` loop (line 81), at the start of the loop body, before the try block:
```typescript
      const vCardIndex = vCards.indexOf(vCard);
      const displayName = (() => {
        try {
          const parsed = vCardToPerson(vCard.data);
          return parsed.name || parsed.surname || 'Unknown';
        } catch {
          return 'Unknown';
        }
      })();
```

Wait — that would double-parse. Better approach: emit progress inside the try block, after the parse at line 84, using `parsedData`:

After line 84 (`const parsedData = vCardToPerson(vCard.data);`), add:
```typescript
        onProgress?.({
          phase: 'pull',
          step: 'processing',
          current: vCards.indexOf(vCard) + 1,
          total: vCards.length,
          contact: parsedData.name
            ? `${parsedData.name}${parsedData.surname ? ` ${parsedData.surname}` : ''}`
            : parsedData.surname || 'Unknown',
        });
```

**Step 3: Add `onProgress` parameter to `syncToServer`**

Change the function signature at line 263 from:

```typescript
export async function syncToServer(
  userId: string
): Promise<SyncResult> {
```

to:

```typescript
export async function syncToServer(
  userId: string,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
```

Add progress calls at these points:

After `const connection = await prisma.cardDavConnection.findUnique(...)` (after line 280):
```typescript
    onProgress?.({ phase: 'push', step: 'connecting' });
```

After `const addressBook = addressBooks[0]` (after line 301):
```typescript
    onProgress?.({ phase: 'push', step: 'fetching' });
```

For the mapped contacts loop (line 324), we need a counter. Before the loop, compute the total of contacts that actually have changes. Since we won't know until we check each one, use `mappings.length` as the total and track a counter:

Before line 324, add:
```typescript
    let pushCount = 0;
    const pushTotal = mappings.length;
```

Inside the loop (line 324), after the `if (!localChanged && mapping.syncStatus === 'synced')` skip check (after line 334), add:
```typescript
        pushCount++;
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: pushCount,
          total: pushTotal,
          contact: mapping.person.name
            ? `${mapping.person.name}${mapping.person.surname ? ` ${mapping.person.surname}` : ''}`
            : mapping.person.surname || 'Unknown',
        });
```

For the unmapped persons loop (line 452), before the loop add:
```typescript
    const unmappedTotal = unmappedPersons.length;
```

Inside the loop at line 452, at the start of the try block:
```typescript
        pushCount++;
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: pushCount,
          total: pushTotal + unmappedTotal,
          contact: person.name
            ? `${person.name}${person.surname ? ` ${person.surname}` : ''}`
            : person.surname || 'Unknown',
        });
```

Actually, that's wrong — `pushCount` started from mapped contacts. Better: use a single counter across both loops. Update `pushTotal` to include unmapped once we know the count.

Revised approach — before the mapped loop (line 324), add:
```typescript
    let pushCurrent = 0;
```

After the unmapped persons query (after line 450), add:
```typescript
    const totalPushContacts = mappings.length + unmappedPersons.length;
```

In the mapped loop, after the skip check (after line 334):
```typescript
        pushCurrent++;
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: pushCurrent,
          total: totalPushContacts,
          contact: mapping.person.name
            ? `${mapping.person.name}${mapping.person.surname ? ` ${mapping.person.surname}` : ''}`
            : mapping.person.surname || 'Unknown',
        });
```

Wait, the unmapped persons query happens after the mapped loop ends. So we don't know `totalPushContacts` yet during the mapped loop. Since we need `total` during the mapped loop but don't have `unmappedPersons.length` yet, let's use `mappings.length` for the mapped phase and then a separate counter for unmapped:

Final approach — keep it simple. In the mapped loop, use `mappings.length` as total. In the unmapped loop, use `unmappedPersons.length` as total with a fresh counter. The UI just shows "Processing contact N of M" which resets between sub-phases — this is fine.

In the mapped loop, after the skip check (after line 334):
```typescript
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: mappings.indexOf(mapping) + 1,
          total: mappings.length,
          contact: mapping.person.name
            ? `${mapping.person.name}${mapping.person.surname ? ` ${mapping.person.surname}` : ''}`
            : mapping.person.surname || 'Unknown',
        });
```

In the unmapped loop (line 452), inside the try block at the start:
```typescript
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: unmappedPersons.indexOf(person) + 1,
          total: unmappedPersons.length,
          contact: person.name
            ? `${person.name}${person.surname ? ` ${person.surname}` : ''}`
            : person.surname || 'Unknown',
        });
```

**Step 4: Add `onProgress` parameter to `bidirectionalSync`**

Change line 534 from:

```typescript
export async function bidirectionalSync(userId: string): Promise<SyncResult> {
```

to:

```typescript
export async function bidirectionalSync(userId: string, onProgress?: SyncProgressCallback): Promise<SyncResult> {
```

Pass it through on lines 536-539:

```typescript
  const pullResult = await syncFromServer(userId, onProgress);
  const pushResult = await syncToServer(userId, onProgress);
```

**Step 5: Verify cron route still works**

`app/api/cron/carddav-sync/route.ts` calls `bidirectionalSync(connection.userId)` without a callback. Since `onProgress` is optional, this works with no changes.

**Step 6: Commit**

```bash
git add lib/carddav/sync.ts
git commit -m "Add onProgress callback to sync engine for SSE support"
```

---

### Task 2: Convert sync API route to SSE streaming

**Files:**
- Modify: `app/api/carddav/sync/route.ts`

**Step 1: Rewrite the POST handler to use SSE streaming**

Replace the entire file contents with:

```typescript
import { auth } from '@/lib/auth';
import { bidirectionalSync } from '@/lib/carddav/sync';
import type { SyncProgressEvent } from '@/lib/carddav/sync';

export async function POST(_request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      const onProgress = (event: SyncProgressEvent) => {
        sendEvent('progress', event as unknown as Record<string, unknown>);
      };

      try {
        const result = await bidirectionalSync(userId, onProgress);

        sendEvent('complete', {
          imported: result.imported,
          exported: result.exported,
          updatedLocally: result.updatedLocally,
          updatedRemotely: result.updatedRemotely,
          conflicts: result.conflicts,
          errors: result.errors,
          errorMessages: result.errorMessages,
          pendingImports: result.pendingImports || 0,
        });
      } catch (error) {
        console.error('Manual sync failed:', error);
        sendEvent('error', {
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

**Step 2: Commit**

```bash
git add app/api/carddav/sync/route.ts
git commit -m "Convert sync API to SSE streaming for real-time progress"
```

---

### Task 3: Add i18n translation keys

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/es-ES.json`

**Step 1: Add English translation keys**

In `locales/en.json`, after the `"syncInProgress"` key (line 224), add these new keys:

```json
      "syncConnecting": "Connecting to server...",
      "syncFetchingContacts": "Fetching contacts from server...",
      "syncProcessingPull": "Downloading contact {current} of {total}",
      "syncPushingChanges": "Checking local changes...",
      "syncProcessingPush": "Uploading contact {current} of {total}",
```

**Step 2: Add Spanish translation keys**

In `locales/es-ES.json`, after the `"syncInProgress"` key (line 224), add these new keys:

```json
      "syncConnecting": "Conectando al servidor...",
      "syncFetchingContacts": "Descargando contactos del servidor...",
      "syncProcessingPull": "Descargando contacto {current} de {total}",
      "syncPushingChanges": "Verificando cambios locales...",
      "syncProcessingPush": "Subiendo contacto {current} de {total}",
```

**Step 3: Commit**

```bash
git add locales/en.json locales/es-ES.json
git commit -m "Add i18n keys for sync progress messages"
```

---

### Task 4: Update SyncProgressModal to read SSE stream

**Files:**
- Modify: `components/carddav/SyncProgressModal.tsx`

**Step 1: Replace the entire component with the SSE-aware version**

Replace the full file contents with:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SyncResult {
  imported: number;
  exported: number;
  updatedLocally: number;
  updatedRemotely: number;
  conflicts: number;
  errors: number;
  pendingImports: number;
}

interface SyncProgress {
  phase: 'pull' | 'push';
  step: 'connecting' | 'fetching' | 'processing';
  current?: number;
  total?: number;
  contact?: string;
}

export default function SyncProgressModal({
  isOpen,
  onClose,
}: SyncProgressModalProps) {
  const t = useTranslations('settings.carddav');
  const router = useRouter();

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-start sync when modal opens
  useEffect(() => {
    if (isOpen && !isSyncing && !syncResult && !error) {
      performSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsSyncing(false);
      setSyncResult(null);
      setError('');
      setProgress(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  const performSync = async () => {
    setIsSyncing(true);
    setError('');
    setSyncResult(null);
    setProgress(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/carddav/sync', {
        method: 'POST',
        signal: abortController.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || t('syncFailed'));
        setIsSyncing(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError(t('syncError'));
        setIsSyncing(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7);
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            // End of event
            try {
              const parsed = JSON.parse(currentData);

              if (currentEvent === 'progress') {
                setProgress(parsed as SyncProgress);
              } else if (currentEvent === 'complete') {
                setSyncResult({
                  imported: Number(parsed.imported) || 0,
                  exported: Number(parsed.exported) || 0,
                  updatedLocally: Number(parsed.updatedLocally) || 0,
                  updatedRemotely: Number(parsed.updatedRemotely) || 0,
                  conflicts: Number(parsed.conflicts) || 0,
                  errors: Number(parsed.errors) || 0,
                  pendingImports: Number(parsed.pendingImports) || 0,
                });
                router.refresh();
              } else if (currentEvent === 'error') {
                setError(parsed.error || t('syncFailed'));
              }
            } catch {
              // Skip malformed events
            }
            currentEvent = '';
            currentData = '';
          } else if (line !== '' && !line.startsWith('event: ') && !line.startsWith('data: ')) {
            // Incomplete event, put back in buffer
            buffer = line;
          }
        }

        // If we have an incomplete event at end of chunk, keep it in buffer
        if (currentEvent || currentData) {
          if (currentEvent) buffer = `event: ${currentEvent}\n`;
          if (currentData) buffer += `data: ${currentData}\n`;
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return; // Modal was closed, ignore
      }
      setError(t('syncError'));
    } finally {
      setIsSyncing(false);
      abortControllerRef.current = null;
    }
  };

  const getProgressMessage = (): string => {
    if (!progress) return t('syncInProgress');

    if (progress.step === 'connecting') {
      return t('syncConnecting');
    }

    if (progress.step === 'fetching') {
      if (progress.phase === 'pull') return t('syncFetchingContacts');
      return t('syncPushingChanges');
    }

    if (progress.step === 'processing' && progress.current != null && progress.total != null) {
      if (progress.phase === 'pull') {
        return t('syncProcessingPull', { current: progress.current, total: progress.total });
      }
      return t('syncProcessingPush', { current: progress.current, total: progress.total });
    }

    return t('syncInProgress');
  };

  const handleClose = () => {
    if (!isSyncing) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isSyncing ? t('syncProgressTitle') : error ? t('syncFailedTitle') : t('syncCompleteTitle')}
      size="md"
    >
      <div className="space-y-6">
        {/* Syncing state */}
        {isSyncing && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-muted">
              {getProgressMessage()}
            </p>
            {progress?.step === 'processing' && progress.contact && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 truncate max-w-xs mx-auto">
                {progress.contact}
              </p>
            )}
          </div>
        )}

        {/* Error state */}
        {error && !isSyncing && (
          <div>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg border border-red-200 dark:border-red-800">
              <p className="font-medium mb-2">{t('syncErrorMessage')}</p>
              <p className="text-sm">{error}</p>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={handleClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}

        {/* Success state */}
        {syncResult && !isSyncing && !error && (
          <div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                {t('syncResults')}
              </h3>

              <div className="space-y-3">
                {/* Imported */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('importedCount', { count: syncResult.imported })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('importedTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.imported}</span>
                </div>

                {/* Exported */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('exportedCount', { count: syncResult.exported })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('exportedTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.exported}</span>
                </div>

                {/* Updated locally (from server) */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('updatedLocallyCount', { count: syncResult.updatedLocally })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('updatedLocallyTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.updatedLocally}</span>
                </div>

                {/* Updated remotely (to server) */}
                <div className="flex justify-between items-start p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-sm text-muted">{t('updatedRemotelyCount', { count: syncResult.updatedRemotely })}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{t('updatedRemotelyTooltip')}</p>
                  </div>
                  <span className="text-lg font-bold text-foreground ml-4">{syncResult.updatedRemotely}</span>
                </div>

                {/* Conflicts */}
                {syncResult.conflicts > 0 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                      {t('conflictsDetected', { count: syncResult.conflicts })}
                    </p>
                    <Link
                      href="/carddav/conflicts"
                      className="text-sm text-amber-700 dark:text-amber-300 hover:underline font-medium"
                    >
                      {t('viewConflictsButton')} →
                    </Link>
                  </div>
                )}

                {/* Pending imports */}
                {syncResult.pendingImports > 0 && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      {t('syncPendingImports', { count: syncResult.pendingImports })}
                    </p>
                    <Link
                      href="/carddav/import"
                      className="text-sm text-blue-700 dark:text-blue-300 hover:underline font-medium"
                    >
                      {t('viewPendingButton')} →
                    </Link>
                  </div>
                )}

                {/* Errors */}
                {syncResult.errors > 0 && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-900 dark:text-red-100">
                      {t('errorsOccurred', { count: syncResult.errors })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
```

**Step 2: Commit**

```bash
git add components/carddav/SyncProgressModal.tsx
git commit -m "Update sync modal to show real-time SSE progress"
```

---

### Task 5: Manual test

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Test the sync flow**

1. Navigate to Settings > CardDAV
2. Click "Sync Now"
3. Verify the modal shows real-time progress:
   - "Connecting to server..." appears first
   - "Fetching contacts from server..." appears next
   - "Downloading contact N of M" with contact name appears for each contact
   - If there are local changes, "Uploading contact N of M" appears
   - Final results screen appears with counts
4. Test error case: disconnect network, click "Sync Now", verify error displays

**Step 3: Commit all changes together if any fixes were needed**

```bash
git add -A
git commit -m "Fix sync progress issues found during testing"
```
