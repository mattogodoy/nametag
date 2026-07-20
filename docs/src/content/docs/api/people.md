---
title: People
description: API endpoints for managing people (contacts) in your network.
sidebar:
  order: 3
---

People are the core entity in Nametag. Only `name` is required; everything else, from phone numbers to important dates, is optional and can be added incrementally.

All endpoints on this page require authentication (session cookie or API token) and operate only on people owned by the authenticated user. Deleted people are excluded unless an endpoint says otherwise.

## List all people

```
GET /api/people
```

Returns all people for the authenticated user, sorted alphabetically by name.

**Query parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `groupIds` | string | Comma-separated group IDs. Only people belonging to at least one of these groups are returned. |
| `includeDetails` | boolean | Defaults to `true`. Set to `false` to skip multi-value fields (phones, emails, addresses, URLs, IM handles, locations, custom fields) for a lighter list-view payload. |
| `includeAll` | boolean | Set to `true` to also include important dates, person-to-person relationships, and typed custom field values. Used by data export. |

```bash
curl https://your-instance.example.com/api/people?includeDetails=false \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "people": [ { "id": "clx1", "name": "Ada", "surname": "Lovelace" } ] }
```

## Create a person

```
POST /api/people
```

Adds a new person. Can include group memberships, important dates, multi-value contact fields, and a relationship type either to you or, via `connectedThroughId`, to another person.

**Request body**

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Required, 1-100 characters. |
| `surname`, `middleName`, `secondLastName`, `nickname` | string or null | Optional name components. |
| `prefix`, `suffix` | string or null | Honorific prefix/suffix (Dr., Jr.). |
| `organization`, `jobTitle` | string or null | |
| `gender` | string or null | |
| `anniversary`, `lastContact` | ISO date string or null | |
| `notes` | string or null | Markdown, up to 10,000 characters. |
| `relationshipToUserId` | string or null | ID of a relationship type describing how this person relates to you. |
| `connectedThroughId` | string | If set, creates a person-to-person relationship instead of a relationship to you. |
| `groupIds` | string[] | Group IDs to add this person to. |
| `importantDates` | array | See [Important dates](#important-dates) below. |
| `contactReminderEnabled`, `contactReminderInterval`, `contactReminderIntervalUnit` | | Contact reminder configuration. |
| `cardDavSyncEnabled` | boolean | |
| `displayNameOverride` | string or null | Per-person display name override, used in Nametag and CardDAV sync. |
| `phoneNumbers`, `emails`, `addresses`, `urls`, `imHandles`, `locations`, `customFields` | array | Multi-value vCard-style fields, each `{ type, ...fields }`. |
| `customFieldValues` | array | `{ templateId, value }` pairs for typed custom field templates. |

```bash
curl -X POST https://your-instance.example.com/api/people \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ada",
    "surname": "Lovelace",
    "organization": "Analytical Engine Society",
    "groupIds": ["clxgroup1"],
    "phoneNumbers": [{ "type": "mobile", "number": "+1 555 0100" }],
    "importantDates": [{ "type": "BIRTHDAY", "date": "1815-12-10" }]
  }'
```

```json
{ "person": { "id": "clx1", "name": "Ada", "surname": "Lovelace" } }
```

Returns `403` if you've reached your plan's people limit, `400` for validation errors.

## Get a person by ID

```
GET /api/people/{id}
```

Returns full details including relationships, groups, and important dates.

```bash
curl https://your-instance.example.com/api/people/clx1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "person": { "id": "clx1", "name": "Ada", "surname": "Lovelace" } }
```

## Update a person

```
PUT /api/people/{id}
```

Accepts the same fields as create, all optional. When `groupIds`, `importantDates`, or any multi-value field array is provided, it fully replaces the existing set for that field, it does not merge.

```bash
curl -X PUT https://your-instance.example.com/api/people/clx1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "jobTitle": "Mathematician" }'
```

```json
{ "person": { "id": "clx1", "name": "Ada", "jobTitle": "Mathematician" } }
```

## Delete a person

```
DELETE /api/people/{id}
```

Soft-deletes a person. Restorable within the 30-day retention period.

**Request body** (all optional)

| Field | Type | Description |
| --- | --- | --- |
| `deleteOrphans` | boolean | Also delete people who would become disconnected from the network. |
| `orphanIds` | string[] | Specific orphan IDs to delete, if you don't want all of them. |
| `deleteFromCardDav` | boolean | Also remove the contact from the connected CardDAV server. |

```bash
curl -X DELETE https://your-instance.example.com/api/people/clx1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "deleteOrphans": false }'
```

```json
{ "message": "Person deleted" }
```

## Restore a deleted person

```
POST /api/people/{id}/restore
```

```bash
curl -X POST https://your-instance.example.com/api/people/clx1/restore \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "person": { "id": "clx1", "name": "Ada", "deletedAt": null } }
```

## Search people

```
GET /api/people/search
```

Searches name, surname, middle name, second last name, and nickname. Case-insensitive, returns up to 20 results.

**Query parameters**

| Parameter | Type | Required |
| --- | --- | --- |
| `q` | string | Yes, minimum 1 character. |

```bash
curl "https://your-instance.example.com/api/people/search?q=ada" \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "people": [ { "id": "clx1", "name": "Ada", "surname": "Lovelace" } ] }
```

## Get search index data

```
GET /api/people/search-index
```

Returns a flat, denormalized dataset for client-side search indexing. Multi-value fields (phones, emails, etc.) are joined into single space-separated strings.

```bash
curl https://your-instance.example.com/api/people/search-index \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "people": [ { "id": "clx1", "name": "Ada", "phones": "+1 555 0100", "groups": "Colleagues" } ] }
```

## Find orphaned connections

```
GET /api/people/{id}/orphans
```

Returns people who are only connected to your network through this person, useful as a warning before deletion.

```bash
curl https://your-instance.example.com/api/people/clx1/orphans \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "orphans": [ { "id": "clx2", "fullName": "Charles Babbage" } ] }
```

## Bulk actions

```
POST /api/people/bulk
```

Runs one action against multiple people. Specify either `personIds` or `selectAll: true`.

**Delete**

```json
{
  "action": "delete",
  "personIds": ["clx1", "clx2"],
  "deleteOrphans": false,
  "deleteFromCardDav": false
}
```

**Add to groups**

```json
{
  "action": "addToGroups",
  "selectAll": true,
  "groupIds": ["clxgroup1"]
}
```

**Set relationship type**

```json
{
  "action": "setRelationship",
  "personIds": ["clx1"],
  "relationshipTypeId": "clxtype1"
}
```

```bash
curl -X POST https://your-instance.example.com/api/people/bulk \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "action": "addToGroups", "personIds": ["clx1", "clx2"], "groupIds": ["clxgroup1"] }'
```

```json
{ "success": true, "affectedCount": 2 }
```

## Find orphans for bulk deletion

```
POST /api/people/bulk/orphans
```

Computes the aggregate orphan list for a proposed bulk delete, before you commit to it.

```bash
curl -X POST https://your-instance.example.com/api/people/bulk/orphans \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "personIds": ["clx1", "clx2"] }'
```

```json
{ "orphans": [ { "id": "clx3", "fullName": "Charles Babbage" } ], "hasCardDavSync": false }
```

## Get relationship graph for a person

```
GET /api/people/{id}/graph
```

Returns a D3-compatible graph (`nodes`, `edges`) centered on this person, showing their direct connections.

```bash
curl https://your-instance.example.com/api/people/clx1/graph \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "nodes": [ { "id": "clx1", "label": "Ada Lovelace", "groups": [], "colors": [], "isCenter": true } ],
  "edges": []
}
```

## Duplicate detection and merge

### Find all duplicate groups

```
GET /api/people/duplicates
```

Scans all contacts and groups likely duplicates by name, email, phone, and birthday similarity. Dismissed pairs are excluded.

```bash
curl https://your-instance.example.com/api/people/duplicates \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "groups": [
    {
      "people": [ { "id": "clx1", "name": "Ada" }, { "id": "clx4", "name": "Ada" } ],
      "similarity": 0.92
    }
  ]
}
```

### Find duplicate candidates for a person

```
GET /api/people/{id}/duplicates
```

```bash
curl https://your-instance.example.com/api/people/clx1/duplicates \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "duplicates": [ { "personId": "clx4", "name": "Ada", "similarity": 0.92 } ] }
```

### Dismiss a duplicate pair

```
POST /api/people/duplicates/dismiss
```

```bash
curl -X POST https://your-instance.example.com/api/people/duplicates/dismiss \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "personAId": "clx1", "personBId": "clx4" }'
```

```json
{ "dismissed": true }
```

### Merge two contacts

```
POST /api/people/merge
```

Merges `secondaryId` into `primaryId`. Relationships, groups, multi-value fields, and important dates transfer; the secondary contact is soft-deleted. `fieldOverrides` lets you pick specific field values to keep from either side.

```bash
curl -X POST https://your-instance.example.com/api/people/merge \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "primaryId": "clx1", "secondaryId": "clx4" }'
```

```json
{ "person": { "id": "clx1", "name": "Ada", "surname": "Lovelace" } }
```

## Important dates

Important dates (birthdays, anniversaries, and custom dates) belong to a person and can carry reminder settings.

### List important dates for a person

```
GET /api/people/{id}/important-dates
```

```bash
curl https://your-instance.example.com/api/people/clx1/important-dates \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "importantDates": [ { "id": "clxdate1", "title": "Birthday", "date": "1815-12-10T00:00:00.000Z" } ] }
```

### Create an important date

```
POST /api/people/{id}/important-dates
```

| Field | Type | Notes |
| --- | --- | --- |
| `type` | string or null | A predefined type (e.g. `BIRTHDAY`), or `null` for a custom date. |
| `title` | string | Required if `type` is not set. |
| `date` | ISO date string | Required. |
| `yearUnknown` | boolean | Set when only month/day is known. |
| `reminderEnabled` | boolean | |
| `reminderType` | `ONCE` \| `RECURRING` \| null | |
| `reminderInterval` | integer 1-99, or null | |
| `reminderIntervalUnit` | `DAYS` \| `WEEKS` \| `MONTHS` \| `YEARS`, or null | |

```bash
curl -X POST https://your-instance.example.com/api/people/clx1/important-dates \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "BIRTHDAY",
    "date": "1815-12-10",
    "reminderEnabled": true,
    "reminderType": "RECURRING",
    "reminderInterval": 3,
    "reminderIntervalUnit": "DAYS"
  }'
```

```json
{ "importantDate": { "id": "clxdate1", "title": "", "date": "1815-12-10T00:00:00.000Z" } }
```

Returns `403` if you've reached your plan's reminder limit.

### Update an important date

```
PUT /api/people/{id}/important-dates/{dateId}
```

Same body as create.

```bash
curl -X PUT https://your-instance.example.com/api/people/clx1/important-dates/clxdate1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "date": "1815-12-10", "type": "BIRTHDAY", "reminderEnabled": false }'
```

```json
{ "importantDate": { "id": "clxdate1", "reminderEnabled": false } }
```

### Delete an important date

```
DELETE /api/people/{id}/important-dates/{dateId}
```

Soft-deletes; restorable within the retention period.

```bash
curl -X DELETE https://your-instance.example.com/api/people/clx1/important-dates/clxdate1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "message": "Important date deleted" }
```

### Restore a deleted important date

```
POST /api/people/{id}/important-dates/{dateId}/restore
```

```bash
curl -X POST https://your-instance.example.com/api/people/clx1/important-dates/clxdate1/restore \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "importantDate": { "id": "clxdate1", "deletedAt": null } }
```

## Photos

### Upload or replace a person photo

```
POST /api/people/{id}/photo
```

`multipart/form-data` with a `photo` field. The image is cropped to 256x256, converted to JPEG, and stripped of EXIF data.

```bash
curl -X POST https://your-instance.example.com/api/people/clx1/photo \
  -H "Authorization: Bearer ntag_xxx" \
  -F "photo=@ada.jpg"
```

```json
{ "photo": "clx1-a1b2c3.jpg" }
```

### Remove a person photo

```
DELETE /api/people/{id}/photo
```

```bash
curl -X DELETE https://your-instance.example.com/api/people/clx1/photo \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "message": "Photo deleted" }
```

### Get a person photo

```
GET /api/photos/{personId}
```

Returns the raw image bytes with an appropriate `Content-Type`, served from disk.

```bash
curl https://your-instance.example.com/api/photos/clx1 \
  -H "Authorization: Bearer ntag_xxx" \
  -o ada.jpg
```
