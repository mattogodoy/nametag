---
title: Map
description: API endpoint for retrieving plottable map markers for your network.
sidebar:
  order: 7
---

The Map plots geocoded addresses and saved locations across your network. Addresses you add to a person are geocoded automatically in the background; this endpoint returns whatever has finished geocoding so far.

## Get map markers

```
GET /api/map/markers
```

Returns all plottable points for the current user: successfully geocoded addresses and vCard `GEO` locations, the groups each point's person belongs to, and counts of addresses still pending or failed geocoding.

```bash
curl https://your-instance.example.com/api/map/markers \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "markers": [
    {
      "id": "addr_clxaddr1",
      "source": "address",
      "personId": "clx1",
      "personName": "Ada Lovelace",
      "latitude": 51.5074,
      "longitude": -0.1278,
      "label": "Home",
      "city": "London",
      "region": null,
      "country": "United Kingdom",
      "groupIds": ["clxgroup1"]
    }
  ],
  "groups": [ { "id": "clxgroup1", "name": "Family" } ],
  "pendingCount": 2,
  "failedCount": 0,
  "geocodingEnabled": true
}
```

**Response fields**

| Field | Description |
| --- | --- |
| `markers[].id` | `addr_<addressId>` for a geocoded street address, or `loc_<locationId>` for a manually entered GEO location. |
| `markers[].source` | `address` or `location`. |
| `pendingCount` | Number of addresses still waiting to be geocoded. |
| `failedCount` | Number of addresses that failed geocoding (invalid or unresolvable). |
| `geocodingEnabled` | Whether automatic geocoding is enabled instance-wide and for this user. See [Settings](/features/settings/) and [Map Geocoding](/self-hosting/map-geocoding/) for configuration. |

If `geocodingEnabled` is `false`, `markers` will only include manually entered GEO locations, since street addresses are never sent to a geocoding provider.
