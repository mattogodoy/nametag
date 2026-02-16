# SSE-based Sync Progress Updates

## Problem

The CardDAV sync modal shows only a spinner with "Sync in progress..." until the entire operation completes. For large contact lists, the user has no visibility into what's happening or how far along the sync is.

## Solution

Stream real-time per-contact progress updates from the sync API using Server-Sent Events (SSE).

## SSE Event Types

```
event: progress
data: {"phase":"pull","step":"connecting","message":"Connecting to server..."}

event: progress
data: {"phase":"pull","step":"fetching","message":"Fetching contacts from server..."}

event: progress
data: {"phase":"pull","step":"processing","current":3,"total":85,"contact":"John Smith"}

event: progress
data: {"phase":"push","step":"processing","current":12,"total":30,"contact":"Jane Doe"}

event: complete
data: {"imported":0,"exported":5,"updatedLocally":3,...}

event: error
data: {"error":"Authentication failed"}
```

Three phases visible to the user:
1. **pull** - connecting, fetching vCards, processing each one
2. **push** - connecting, checking local changes, pushing each one
3. **complete** - final results

## Changes by File

### `lib/carddav/sync.ts`

Add an optional `onProgress` callback parameter to `syncFromServer`, `syncToServer`, and `bidirectionalSync`. The callback receives `{phase, step, current?, total?, contact?}`. Called at each meaningful point (connecting, fetching, per-contact processing). No changes to sync logic itself.

### `app/api/carddav/sync/route.ts`

Return a `ReadableStream` with `Content-Type: text/event-stream` instead of JSON. Pass an `onProgress` callback to `bidirectionalSync` that writes SSE events to the stream. Send `complete` or `error` event at the end.

### `components/carddav/SyncProgressModal.tsx`

Replace the `fetch().then(json)` call with a streaming `fetch` that reads the SSE stream. Add new state for `phase`, `current`, `total`, `contactName`. Show the progress counter and contact name during sync instead of just a spinner.

### `locales/en.json` + `locales/es-ES.json`

Add translation keys for phase messages: `syncConnecting`, `syncFetchingContacts`, `syncProcessingContact`, `syncPushingChanges`, etc.

## UI During Sync

Instead of just a spinner with "Sync in progress...", the modal shows:

```
  (spinner)  Fetching contacts from server...

     Processing contact 12 of 85
     John Smith
```

The spinner stays, but the text updates in real time as each contact is processed.
