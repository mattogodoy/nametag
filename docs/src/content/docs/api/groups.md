---
title: Groups
description: API endpoints for creating groups and managing their members.
sidebar:
  order: 4
---

Groups are user-defined categories (family, friends, work, and so on) used to organize and filter people throughout Nametag. A person can belong to any number of groups.

All endpoints require authentication and operate only on the authenticated user's own groups.

## List all groups

```
GET /api/groups
```

Returns all groups with their members.

```bash
curl https://your-instance.example.com/api/groups \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "groups": [
    { "id": "clxgroup1", "name": "Family", "color": "#FF5733", "createdAt": "2026-01-01T00:00:00.000Z" }
  ]
}
```

## Create a group

```
POST /api/groups
```

**Request body**

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Required, 1-100 characters. |
| `description` | string or null | Up to 500 characters. |
| `color` | string or null | Hex color, e.g. `#FF5733`. |
| `peopleIds` | string[] | Person IDs to add as initial members. |

```bash
curl -X POST https://your-instance.example.com/api/groups \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Family", "color": "#FF5733", "peopleIds": ["clx1"] }'
```

```json
{ "group": { "id": "clxgroup1", "name": "Family", "color": "#FF5733" } }
```

Returns `403` if you've reached your plan's group limit.

## Get a group by ID

```
GET /api/groups/{id}
```

```bash
curl https://your-instance.example.com/api/groups/clxgroup1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "group": { "id": "clxgroup1", "name": "Family" } }
```

## Update a group

```
PUT /api/groups/{id}
```

Same body shape as create, minus `peopleIds`.

```bash
curl -X PUT https://your-instance.example.com/api/groups/clxgroup1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Immediate Family", "color": "#FF5733" }'
```

```json
{ "group": { "id": "clxgroup1", "name": "Immediate Family" } }
```

## Delete a group

```
DELETE /api/groups/{id}
```

Soft-deletes a group. Restorable within the 30-day retention period.

**Query parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `deletePeople` | boolean | Also soft-delete every person currently in this group. |

```bash
curl -X DELETE "https://your-instance.example.com/api/groups/clxgroup1?deletePeople=false" \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "message": "Group deleted" }
```

## Restore a deleted group

```
POST /api/groups/{id}/restore
```

```bash
curl -X POST https://your-instance.example.com/api/groups/clxgroup1/restore \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "group": { "id": "clxgroup1", "name": "Family", "deletedAt": null } }
```

## Add a person to a group

```
POST /api/groups/{id}/members
```

```bash
curl -X POST https://your-instance.example.com/api/groups/clxgroup1/members \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "personId": "clx1" }'
```

```json
{ "success": true }
```

## Remove a person from a group

```
DELETE /api/groups/{id}/members/{personId}
```

```bash
curl -X DELETE https://your-instance.example.com/api/groups/clxgroup1/members/clx1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```

## Deleted items

Nametag retains soft-deleted records for 30 days before permanent purge. This endpoint powers the Trash view.

```
GET /api/deleted
```

**Query parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `type` | `people` \| `groups` \| `relationships` \| `relationshipTypes` \| `importantDates` | Yes | Entity type to list. |

```bash
curl "https://your-instance.example.com/api/deleted?type=groups" \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "deleted": [ { "id": "clxgroup2", "name": "Old Book Club", "deletedAt": "2026-07-10T00:00:00.000Z" } ],
  "retentionDays": 30,
  "cutoffDate": "2026-06-20T00:00:00.000Z"
}
```
