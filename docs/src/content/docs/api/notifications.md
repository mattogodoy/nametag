---
title: Notifications
description: API endpoints for the email and browser push reminder channels.
sidebar:
  order: 13
---

These endpoints manage how reminders are delivered: toggling the email channel, and registering or revoking browser push subscriptions. For the reminders themselves, see [Important dates](/api/people/#important-dates) on a person.

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
| `endpoint` | string | Yes | The push service URL from `PushSubscription.endpoint`. Must be `https://`. |
| `keys.p256dh` | string | Yes | From `PushSubscription.toJSON().keys`. |
| `keys.auth` | string | Yes | From `PushSubscription.toJSON().keys`. |

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
