---
title: Import & Export
description: API endpoints for exporting your data, importing it back, and direct vCard file import.
sidebar:
  order: 10
---

Nametag data is portable. These endpoints let you export everything as JSON for backup or migration, validate and re-import that JSON, or import contacts directly from a `.vcf` file without setting up a full CardDAV connection.

All endpoints require authentication and operate only on the authenticated user's own data.

## Data export and import

### Export user data

```
GET /api/user/export
```

Exports people, groups, relationships, relationship types, journal entries, and custom field templates as a single JSON document.

**Query parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `groupIds` | string | Comma-separated group IDs. When set, only exports people in these groups. |

```bash
curl "https://your-instance.example.com/api/user/export?groupIds=clxgroup1" \
  -H "Authorization: Bearer ntag_xxx" \
  -o nametag-export.json
```

```json
{
  "version": "0.53.0",
  "exportDate": "2026-07-20T12:00:00.000Z",
  "user": { "name": "Ada" },
  "groups": [ { "id": "clxgroup1", "name": "Family", "color": "#FF5733" } ],
  "people": [ { "id": "clx1", "name": "Ada", "surname": "Lovelace", "groups": ["Family"] } ],
  "relationshipTypes": [ { "id": "clxtype1", "name": "PARENT", "label": "Parent" } ],
  "journalEntries": [
    {
      "id": "clxj1",
      "title": "Coffee with Ada",
      "date": "2026-07-18T09:00:00.000Z",
      "body": "Caught up on...",
      "people": ["Ada Lovelace"],
      "peopleIds": ["clx1"]
    }
  ],
  "customFieldTemplates": [ { "name": "Dietary restriction", "slug": "dietary-restriction", "type": "TEXT" } ]
}
```

This is the same document format accepted by import, which makes it a straightforward way to move data between Nametag instances or take a full backup.

### Validate import data

```
POST /api/user/import/validate
```

Validates an export-format JSON payload without importing anything. Use this before `POST /api/user/import` to preview what would happen and surface any conflicts.

```bash
curl -X POST https://your-instance.example.com/api/user/import/validate \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  --data-binary @nametag-export.json
```

```json
{ "valid": true, "newPeopleCount": 84, "newGroupsCount": 6 }
```

### Import user data

```
POST /api/user/import
```

Imports people, groups, relationships, relationship types, journal entries, and custom field templates from a Nametag export JSON document. The body must match the same shape returned by `GET /api/user/export`, including at minimum `version`, `exportDate`, `groups`, and `people`.

```bash
curl -X POST https://your-instance.example.com/api/user/import \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  --data-binary @nametag-export.json
```

```json
{
  "success": true,
  "imported": {
    "groups": 6,
    "people": 84,
    "relationshipTypes": 5,
    "journalEntries": 12,
    "customFieldTemplates": 2
  }
}
```

## vCard file import

These endpoints work with a raw `.vcf` file you upload directly, without connecting to a CardDAV server. Maximum file size: 2 MB. For ongoing bidirectional sync with a live server instead, see [CardDAV](/api/carddav/).

### Import a vCard file

```
POST /api/vcard/import
```

Body: raw vCard content, sent with `Content-Type: text/vcard` or `text/plain`. Parses and imports contacts immediately.

```bash
curl -X POST https://your-instance.example.com/api/vcard/import \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: text/vcard" \
  --data-binary @contacts.vcf
```

```json
{ "success": true, "imported": 12, "skipped": 1, "errors": 0, "errorMessages": [] }
```

Returns `413` if the file exceeds 2 MB.

### Upload a vCard for preview

```
POST /api/vcard/upload
```

Same input, but creates pending import records for review (with group assignment) before you commit, rather than importing immediately. Review and commit through [`POST /api/carddav/import`](/api/carddav/#import-selected-contacts).

```bash
curl -X POST https://your-instance.example.com/api/vcard/upload \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: text/vcard" \
  --data-binary @contacts.vcf
```

```json
{ "success": true, "count": 13 }
```
