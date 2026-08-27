---
title: Notifications
description: API endpoints for the email, browser push, and ntfy reminder channels.
sidebar:
  order: 13
---

These endpoints manage how reminders are delivered: toggling the email channel, registering or revoking browser push subscriptions, and managing ntfy destinations. For the reminders themselves, see [Important dates](/api/people/#important-dates) on a person.

## Get the VAPID public key

```
GET /api/notifications/push/public-key
```

Returns the public key browsers need to create a push subscription. Unauthenticated, since the key is public by definition and the subscribe flow has to work before a session is confirmed. Served from a runtime endpoint rather than a build-time environment variable, so it works correctly against a prebuilt Docker image.

Returns `404` if the instance has no VAPID keys configured.

```bash
curl https://your-instance.example.com/api/notifications/push/public-key
```

```json
{ "publicKey": "BN4..." }
```

## Register a push subscription

```
POST /api/notifications/push/subscribe
```

Stores a serialised browser `PushSubscription` for the current device.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `endpoint` | string | Yes | The push service URL from `PushSubscription.endpoint`. Must be `https://`. Capped at 2000 bytes (UTF-8), not 2000 characters, since the column carries a unique index and Postgres caps index entries near 2704 bytes. A 2000-character string of multi-byte characters will be rejected even though it passes a naive character count. |
| `keys.p256dh` | string | Yes | From `PushSubscription.toJSON().keys`. 1 to 255 characters. |
| `keys.auth` | string | Yes | From `PushSubscription.toJSON().keys`. 1 to 255 characters. |

Upserts on `endpoint`: subscribing again with the same endpoint (permission re-granted, key rotated) updates the existing device rather than creating a duplicate.

```bash
curl -X POST https://your-instance.example.com/api/notifications/push/subscribe \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "https://fcm.googleapis.com/fcm/send/xyz",
    "keys": { "p256dh": "BN4...", "auth": "k9d..." }
  }'
```

```json
{ "success": true }
```

Returns `201` on success, `400` for an invalid body, `401` if unauthenticated.

## Revoke a push subscription

```
DELETE /api/notifications/push/subscriptions/{id}
```

Removes one device from push delivery. Scoped to the authenticated user, so it cannot be used to remove another account's device.

```bash
curl -X DELETE https://your-instance.example.com/api/notifications/push/subscriptions/clxpush1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```

Returns `401` if unauthenticated, `404` if the subscription does not exist or belongs to another user.

## Toggle email reminders

```
PUT /api/notifications/email
```

Enables or disables the email channel for reminder notifications.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `enabled` | boolean | Yes | |

```bash
curl -X PUT https://your-instance.example.com/api/notifications/email \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

```json
{ "success": true }
```

Returns `400` for an invalid body, `401` if unauthenticated.

## List notification endpoints

```
GET /api/notifications/endpoints
```

Lists the current user's configured outbound destinations (ntfy topics today). Never returns the stored secret: it is write-only, encrypted at create time.

```bash
curl https://your-instance.example.com/api/notifications/endpoints \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "endpoints": [
    {
      "id": "clxendpoint1",
      "type": "NTFY",
      "label": "Phone",
      "url": "https://ntfy.sh/my-topic",
      "enabled": true,
      "consecutiveFailures": 0,
      "lastSuccessAt": "2026-08-20T09:00:00.000Z",
      "lastFailureAt": null,
      "lastFailureCode": null,
      "autoDisabledAt": null,
      "createdAt": "2026-08-01T12:00:00.000Z"
    }
  ]
}
```

Returns `401` if unauthenticated.

## Create a notification endpoint

```
POST /api/notifications/endpoints
```

Creates a new ntfy destination. The URL is validated against the outbound SSRF policy described in [Notifications](/features/notifications/#technical-details), and must be a full topic URL, for example `https://ntfy.sh/my-topic`. The optional access token is encrypted at rest and never returned by any endpoint. Capped at 5 destinations per user, and rate limited to 10 creations per hour.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | string | Yes | Must be `"NTFY"`. Webhooks are a separate, future channel. |
| `label` | string | Yes | 1 to 60 characters. |
| `url` | string | Yes | A full ntfy topic URL, up to 500 characters. |
| `token` | string | No | ntfy access token, 1 to 255 characters. Only needed for a topic that requires one to publish. |

```bash
curl -X POST https://your-instance.example.com/api/notifications/endpoints \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "type": "NTFY", "label": "Phone", "url": "https://ntfy.sh/my-topic" }'
```

```json
{ "endpoint": { "id": "clxendpoint1", "type": "NTFY", "label": "Phone", "url": "https://ntfy.sh/my-topic", "enabled": true, "consecutiveFailures": 0, "lastSuccessAt": null, "lastFailureAt": null, "lastFailureCode": null, "autoDisabledAt": null, "createdAt": "2026-08-27T12:00:00.000Z" } }
```

Returns `201` on success, `400` if the body fails validation or the URL cannot be used, `401` if unauthenticated, `409` if you already have 5 destinations, `429` if rate limited.

## Update a notification endpoint

```
PUT /api/notifications/endpoints/{id}
```

Relabels a destination, or enables or disables it. Re-enabling clears the auto-disable state and the consecutive failure counter, so a repaired destination gets a clean slate rather than being switched off again on its next single failure.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | No | 1 to 60 characters. |
| `enabled` | boolean | No | |

```bash
curl -X PUT https://your-instance.example.com/api/notifications/endpoints/clxendpoint1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

```json
{ "success": true }
```

Returns `400` for an invalid body, `401` if unauthenticated, `404` if the destination does not exist or belongs to another user.

## Delete a notification endpoint

```
DELETE /api/notifications/endpoints/{id}
```

Permanently deletes a destination. Scoped to the current user, so it cannot be used to delete another account's destination.

```bash
curl -X DELETE https://your-instance.example.com/api/notifications/endpoints/clxendpoint1 \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "success": true }
```

Returns `401` if unauthenticated, `404` if the destination does not exist or belongs to another user.

## Send a test notification

```
POST /api/notifications/endpoints/{id}/test
```

Sends a sample notification to one destination and reports the outcome immediately. This is the tightest rate limit in the app, 5 requests per 15 minutes, since it is a synchronous, user-triggered outbound request. A failed test is reported back but never counted toward auto-disable, and the response never carries a body or status line from the destination, only the coarse failure category below.

```bash
curl -X POST https://your-instance.example.com/api/notifications/endpoints/clxendpoint1/test \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "ok": false, "code": "timeout" }
```

`code` is present only when `ok` is `false`, and is one of `blocked`, `dns`, `timeout`, `refused`, `tls`, `redirect`, `http_4xx`, `http_5xx`, or `unknown`.

Returns `401` if unauthenticated, `404` if the destination does not exist or belongs to another user, `429` if rate limited.
