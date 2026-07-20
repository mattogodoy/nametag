---
title: CardDAV
description: API endpoints for CardDAV connection management, bidirectional sync, and vCard import.
sidebar:
  order: 9
---

Nametag can sync bidirectionally with a CardDAV server (Google Contacts, iCloud, Outlook, Nextcloud, and others). This page covers the API surface; see [CardDAV Sync](/features/carddav/) for the feature overview and provider setup.

Only one CardDAV connection is allowed per user. All endpoints require authentication.

## Connection management

### Create a CardDAV connection

```
POST /api/carddav/connection
```

| Field | Type | Notes |
| --- | --- | --- |
| `serverUrl` | string (URI) | Required. |
| `username` | string | Required. |
| `password` | string | Required. |
| `provider` | string or null | Hint: `google`, `icloud`, `outlook`, `nextcloud`, `custom`. |
| `syncEnabled` | boolean | |
| `autoExportNew` | boolean | Auto-export new Nametag contacts. |
| `autoSyncInterval` | integer | Seconds between automatic syncs, 60-86400. |
| `importMode` | `manual` \| `notify` \| `auto` | How new remote contacts are handled. |
| `cardDavNameFormat` | `FULL` \| `FIRST_LAST` \| `NICKNAME_PREFERRED` \| `SHORT` | Name format used for the vCard `FN` field. |

```bash
curl -X POST https://your-instance.example.com/api/carddav/connection \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "serverUrl": "https://contacts.icloud.com/",
    "username": "ada@example.com",
    "password": "app-specific-password",
    "provider": "icloud",
    "syncEnabled": true
  }'
```

```json
{ "connection": { "id": "clxconn1", "serverUrl": "https://contacts.icloud.com/", "syncEnabled": true } }
```

Returns `409` if a connection already exists.

### Update a CardDAV connection

```
PUT /api/carddav/connection
```

Same fields as create, except `password` is optional (only changed if provided).

```bash
curl -X PUT https://your-instance.example.com/api/carddav/connection \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "serverUrl": "https://contacts.icloud.com/", "username": "ada@example.com", "autoSyncInterval": 900 }'
```

```json
{ "connection": { "id": "clxconn1", "autoSyncInterval": 900 } }
```

### Delete a CardDAV connection

```
DELETE /api/carddav/connection
```

Disconnects and deletes the connection along with all sync mappings and pending imports.

```bash
curl -X DELETE https://your-instance.example.com/api/carddav/connection \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```

### Test CardDAV credentials

```
POST /api/carddav/connection/test
```

Tests connectivity without saving credentials.

```bash
curl -X POST https://your-instance.example.com/api/carddav/connection/test \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "serverUrl": "https://contacts.icloud.com/", "username": "ada@example.com", "password": "app-specific-password" }'
```

```json
{ "success": true, "message": "Connection successful" }
```

Returns `401` for bad credentials, `404` if the server can't be found, `408` on timeout.

## Sync

### Manual bidirectional sync

```
POST /api/carddav/sync
```

Triggers a full sync and streams progress as Server-Sent Events. Event types: `progress` (in-flight updates), `complete` (final counts), `error`.

The `complete` event payload includes `imported`, `exported`, `updatedLocally`, `updatedRemotely`, `conflicts`, `errors`, `errorMessages`, and `pendingImports`.

```bash
curl -N -X POST https://your-instance.example.com/api/carddav/sync \
  -H "Authorization: Bearer ntag_xxx"
```

```
event: progress
data: {"phase":"fetching","message":"Fetching remote changes"}

event: complete
data: {"imported":2,"exported":1,"updatedLocally":0,"updatedRemotely":0,"conflicts":0,"errors":0,"errorMessages":[],"pendingImports":0}
```

### Discover new contacts

```
POST /api/carddav/discover
```

Scans the server for contacts not yet imported and creates pending import records.

```bash
curl -X POST https://your-instance.example.com/api/carddav/discover \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true, "discovered": 5, "errors": 0, "errorMessages": [] }
```

### Get pending import count

```
GET /api/carddav/pending-count
```

Used for a notification badge.

```bash
curl https://your-instance.example.com/api/carddav/pending-count \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "count": 5 }
```

## Import and export

### Import selected contacts

```
POST /api/carddav/import
```

Imports previously discovered pending contacts.

| Field | Type | Notes |
| --- | --- | --- |
| `importIds` | string[] | Required, at least 1. IDs of pending imports to import. |
| `globalGroupIds` | string[] | Group IDs to assign to all imported contacts. |
| `perContactGroups` | object | Map of import ID to group IDs, for per-contact assignment. |

```bash
curl -X POST https://your-instance.example.com/api/carddav/import \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "importIds": ["clxpend1", "clxpend2"], "globalGroupIds": ["clxgroup1"] }'
```

```json
{ "success": true, "imported": 2, "skipped": 0, "errors": 0, "errorMessages": [] }
```

### Bulk export contacts

```
POST /api/carddav/export-bulk
```

Exports selected Nametag contacts to the connected server, in batches of 50.

```bash
curl -X POST https://your-instance.example.com/api/carddav/export-bulk \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "personIds": ["clx1", "clx2"] }'
```

```json
{ "success": true, "exported": 2, "skipped": 0, "errors": 0, "errorMessages": [] }
```

### Download vCard backup

```
POST /api/carddav/backup
```

Downloads every contact from the connected server as a single `.vcf` file.

```bash
curl -X POST https://your-instance.example.com/api/carddav/backup \
  -H "Authorization: Bearer ntag_xxx" \
  -o nametag-backup.vcf
```

Response headers include `Content-Disposition: attachment; filename="nametag-backup.vcf"` and `X-Contact-Count`.

## Conflict resolution

### Resolve a sync conflict

```
POST /api/carddav/conflicts/{id}/resolve
```

| Field | Type | Notes |
| --- | --- | --- |
| `resolution` | `keep_local` \| `keep_remote` \| `merged` | Required. |

```bash
curl -X POST https://your-instance.example.com/api/carddav/conflicts/clxconf1/resolve \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "resolution": "keep_local" }'
```

```json
{ "success": true }
```

Direct, one-off `.vcf` file import (without a CardDAV server connection) is covered in [Import & Export](/api/import-export/).

## Background sync (cron)

```
GET /api/cron/carddav-sync
```

Syncs every user with CardDAV enabled who is due for a sync, with a 200ms delay between users. Authenticated with a bearer token matching the `CRON_SECRET` environment variable, not a user session or API token. Intended to be called by your deployment's scheduler, see [Cron Jobs](/self-hosting/cron-jobs/).

```bash
curl https://your-instance.example.com/api/cron/carddav-sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

```json
{ "success": true, "total": 40, "synced": 38, "skipped": 1, "errors": 1, "errorMessages": ["..."] }
```
