---
title: Dashboard
description: API endpoints for dashboard statistics and the full network graph.
sidebar:
  order: 8
---

The Dashboard gives you a user-centric overview of your network: upcoming events and a graph of everyone you're connected to.

## Get dashboard statistics

```
GET /api/dashboard/stats
```

Returns upcoming events (important dates and contact reminders due within 30 days), plus total people and group counts.

```bash
curl https://your-instance.example.com/api/dashboard/stats \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "upcomingEvents": [
    {
      "id": "clxdate1",
      "personId": "clx1",
      "personName": "Ada Lovelace",
      "type": "important_date",
      "title": "Birthday",
      "titleKey": null,
      "date": "2026-08-01T00:00:00.000Z",
      "daysUntil": 12,
      "isYearUnknown": false
    }
  ],
  "peopleCount": 84,
  "groupsCount": 6
}
```

`type` is either `important_date` or `contact_reminder`. For contact reminders, `titleKey` is `"timeToCatchUp"` for client-side translation instead of a stored `title`.

## Get full network graph

```
GET /api/dashboard/graph
```

Returns a D3-compatible graph (`nodes`, `edges`) of all people and their relationships, centered on you. Supports filtering by group.

**Query parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `includeGroupIds` | comma-separated string | Only include people belonging to at least one (or all, see `groupMatchOperator`) of these groups. |
| `excludeGroupIds` | comma-separated string | Exclude people belonging to any of these groups. |
| `groupMatchOperator` | `and` \| `or` | How to match `includeGroupIds`. Defaults to `or`. |
| `limit` | integer | Maximum number of people to include. |

```bash
curl "https://your-instance.example.com/api/dashboard/graph?includeGroupIds=clxgroup1,clxgroup2&groupMatchOperator=or&limit=100" \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "nodes": [
    { "id": "clx1", "label": "Ada Lovelace", "groups": ["Family"], "colors": ["#FF5733"], "isCenter": false }
  ],
  "edges": [
    { "source": "user", "target": "clx1", "type": "Friend", "color": "#4287f5" }
  ]
}
```
