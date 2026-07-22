---
title: Relationships
description: API endpoints for connections between people and custom relationship types.
sidebar:
  order: 5
---

Relationships connect two people in your network (parent/child, sibling, partner, friend, and so on). Nametag handles bidirectionality automatically: creating a relationship also creates its inverse.

All endpoints require authentication and operate only on the authenticated user's own data.

## Relationships

### List all relationships

```
GET /api/relationships
```

Returns every relationship in your network, including the two people and the relationship type.

```bash
curl https://your-instance.example.com/api/relationships \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "relationships": [
    {
      "id": "clxrel1",
      "personId": "clx1",
      "relatedPersonId": "clx2",
      "relationshipTypeId": "clxtype1",
      "person": { "id": "clx1", "name": "Ada" },
      "relatedPerson": { "id": "clx2", "name": "Charles" },
      "relationshipType": { "id": "clxtype1", "label": "Friend" }
    }
  ]
}
```

### Create a relationship

```
POST /api/relationships
```

Creates a directional relationship and its inverse in one call.

| Field | Type | Notes |
| --- | --- | --- |
| `personId` | string | Required, first person. |
| `relatedPersonId` | string | Required, second person. |
| `relationshipTypeId` | string or null | The relationship type to apply. |
| `notes` | string or null | Up to 1,000 characters. |

```bash
curl -X POST https://your-instance.example.com/api/relationships \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "personId": "clx1", "relatedPersonId": "clx2", "relationshipTypeId": "clxtype1" }'
```

```json
{ "relationship": { "id": "clxrel1", "personId": "clx1", "relatedPersonId": "clx2" } }
```

### Get a relationship by ID

```
GET /api/relationships/{id}
```

```bash
curl https://your-instance.example.com/api/relationships/clxrel1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "relationship": { "id": "clxrel1", "personId": "clx1", "relatedPersonId": "clx2" } }
```

### Update a relationship

```
PUT /api/relationships/{id}
```

Changes the type and/or notes. The inverse relationship is updated to match.

```bash
curl -X PUT https://your-instance.example.com/api/relationships/clxrel1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "relationshipTypeId": "clxtype2", "notes": "Met at a conference" }'
```

```json
{ "relationship": { "id": "clxrel1", "relationshipTypeId": "clxtype2" } }
```

### Delete a relationship

```
DELETE /api/relationships/{id}
```

Soft-deletes the relationship and its inverse.

```bash
curl -X DELETE https://your-instance.example.com/api/relationships/clxrel1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "message": "Relationship deleted" }
```

### Restore a deleted relationship

```
POST /api/relationships/{id}/restore
```

```bash
curl -X POST https://your-instance.example.com/api/relationships/clxrel1/restore \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "relationship": { "id": "clxrel1", "deletedAt": null } }
```

### Permanently delete a relationship

```
DELETE /api/relationships/{id}/permanent
```

Permanently deletes a soft-deleted relationship and its inverse. This cannot be undone.

```bash
curl -X DELETE https://your-instance.example.com/api/relationships/clxrel1/permanent \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```

## Relationship types

Relationship types are your own vocabulary for categorizing relationships, e.g. Parent/Child, Friend, Manager. A type can be symmetric (its own inverse, like Friend) or asymmetric with a distinct inverse (Parent -> Child).

### List all relationship types

```
GET /api/relationship-types
```

```bash
curl https://your-instance.example.com/api/relationship-types \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "relationshipTypes": [
    { "id": "clxtype1", "name": "PARENT", "label": "Parent", "inverseId": "clxtype2" }
  ]
}
```

### Create a relationship type

```
POST /api/relationship-types
```

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Required, 1-50 characters, stored upper-cased. |
| `label` | string | Required, 1-50 characters, display label. |
| `color` | string or null | Hex color. |
| `inverseId` | string or null | ID of an existing type to use as the inverse. |
| `inverseLabel` | string | Label for a new inverse type to auto-create, if `inverseId` isn't given. |
| `symmetric` | boolean | If true, the type is its own inverse (e.g. Friend). |

```bash
curl -X POST https://your-instance.example.com/api/relationship-types \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "name": "PARENT", "label": "Parent", "inverseLabel": "Child" }'
```

```json
{ "relationshipType": { "id": "clxtype1", "name": "PARENT", "label": "Parent", "inverseId": "clxtype2" } }
```

### Get a relationship type by ID

```
GET /api/relationship-types/{id}
```

```bash
curl https://your-instance.example.com/api/relationship-types/clxtype1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "relationshipType": { "id": "clxtype1", "label": "Parent" } }
```

### Update a relationship type

```
PUT /api/relationship-types/{id}
```

Same body as create.

```bash
curl -X PUT https://your-instance.example.com/api/relationship-types/clxtype1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "name": "PARENT", "label": "Parent", "color": "#4287f5" }'
```

```json
{ "relationshipType": { "id": "clxtype1", "color": "#4287f5" } }
```

### Delete a relationship type

```
DELETE /api/relationship-types/{id}
```

Soft-deletes the type. Fails with `400` if the type is currently in use by any relationship.

```bash
curl -X DELETE https://your-instance.example.com/api/relationship-types/clxtype1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```

### Restore a deleted relationship type

```
POST /api/relationship-types/{id}/restore
```

```bash
curl -X POST https://your-instance.example.com/api/relationship-types/clxtype1/restore \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "relationshipType": { "id": "clxtype1", "deletedAt": null } }
```

### Permanently delete a relationship type

```
DELETE /api/relationship-types/{id}/permanent
```

Permanently deletes a soft-deleted relationship type and clears any remaining references to it. This cannot be undone.

```bash
curl -X DELETE https://your-instance.example.com/api/relationship-types/clxtype1/permanent \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```
