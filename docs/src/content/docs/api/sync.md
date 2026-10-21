---
title: Sync
description: API endpoint for keeping a local copy of your data up to date with incremental changes.
sidebar:
  order: 15
---

The sync endpoint is a change feed for native clients that keep a local cache. Instead of downloading everything on each launch, a client asks for what changed since the last time it synced.

## Get changes

```
GET /api/sync?cursor=<string>&limit=<int>
```

| Parameter | Required | Description |
| --- | --- | --- |
| `cursor` | Yes | Where to resume. Use `"0"` for the first sync, then the `cursor` from the previous response. |
| `limit` | No | Maximum number of records per page. Default 500, maximum 1000. |

### Response

```json
{
  "cursor": "1234",
  "hasMore": false,
  "changes": {
    "people": [],
    "groups": [],
    "relationships": [],
    "importantDates": [],
    "relationshipTypes": [],
    "journalEntries": [],
    "customFieldTemplates": []
  },
  "deleted": [{ "type": "person", "id": "..." }]
}
```

- `cursor`: pass this on the next request.
- `hasMore`: `true` when more changes are waiting and you should request the next page right away.
- `changes`: created or updated records, grouped by type. Each record carries a `syncVersion` string.
- `deleted`: records that were permanently removed. `type` is one of `person`, `group`, `relationship`, `importantDate`, `relationshipType`, `journalEntry` or `customFieldTemplate`.

People include their contact child arrays (phones, emails, addresses and so on), `groupIds`, and `customFieldValues` as plain rows (id, template id, value and timestamps). Custom field templates are synced separately. Journal entries include `personIds`. Decimal fields such as address and location latitude and longitude are sent as numeric strings, for example `"37.386013"`.

## The sync loop

1. Start with cursor `"0"`.
2. Request a page and apply it to the local cache.
3. Store the returned `cursor` only after the page has been applied.
4. Repeat with the new cursor while `hasMore` is `true`.

## Soft-deleted records

Records in the trash are included in `changes` with `deletedAt` set, so a client can hide them or show them in a trash view. When a trashed record is restored, it comes back with `deletedAt` set to `null`.

## Deletions and retention

Permanent deletions are remembered as tombstones for 90 days and reported in `deleted`. A cursor older than the retained tombstones cannot be served reliably.

A full sync from `0` is not affected by this while it pages. Its cursors can look like `"812:950"`, which records how far the purge had gone when the sync started, and stay valid until the next purge. If a purge runs in the middle of a full sync, the next page returns `410` and the sync starts again from `0`.

## Errors

- `410 sync_cursor_expired`: the cursor is older than the retained deletions. Discard the local cache and sync again from cursor `0`.
- `400 invalid_query`: the `cursor` or `limit` is malformed. A cursor ahead of the server (for example after the server was restored from a backup) also returns this, and calls for a full resync from `0`.

See [Errors](/api/errors/) for the error format.

## Technical details

- Default page size is 500 records, maximum 1000. Larger values are clamped to 1000.
- `limit` must be a positive integer.
- Treat the cursor as an opaque string and send it back unchanged. It is a decimal number of up to 19 digits, or two of them joined by a colon during a full sync.
- Cursor `0` is always valid.
- `cursor` and every record's `syncVersion` are strings, because the values can exceed the safe integer range in JavaScript.
- Decimal fields (address and location `latitude` and `longitude`) are numeric strings.
- A write to synced data takes a short lock on that user's change counter. One very long transaction therefore delays that user's other writes until it commits.
- Two concurrent writes for the same user that touch several records can deadlock on that lock. The server retries the losing write up to 3 times, and writes that change many records take the lock first so they wait their turn instead.
- After upgrading to the release that adds sync, existing data is numbered once, so the first sync from cursor `0` returns everything.
