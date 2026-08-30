---
title: Notifications
description: API endpoints for the email, browser push, and ntfy reminder channels.
sidebar:
  order: 13
---

These endpoints manage how reminders are delivered: toggling the email channel, registering or revoking browser push subscriptions, and managing ntfy and webhook destinations. For the reminders themselves, see [Important dates](/api/people/#important-dates) on a person. For the outgoing webhook payload shape and how to verify its signature, see [Notifications](/features/notifications/#sending-reminders-to-a-webhook).

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

Lists the current user's configured outbound destinations (ntfy topics and outgoing webhooks). Never returns the stored secret: it is write-only, encrypted at create time.

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

Creates a new ntfy or webhook destination. Both types validate the URL against the outbound SSRF policy described in [Notifications](/features/notifications/#technical-details) before storing it. Capped at 5 destinations per user across both types, and rate limited to 10 creations per hour. The cap is enforced under a row lock, so concurrent requests cannot both slip past it. For ntfy, the server is also checked to be a real ntfy server before the destination is stored. Credentials in the URL itself (`https://user:password@host/topic`) are rejected for both types rather than silently dropped.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | string | Yes | `"NTFY"` or `"WEBHOOK"`. |
| `label` | string | Yes | 1 to 60 characters. |
| `url` | string | Yes | For `NTFY`, a full topic URL, for example `https://ntfy.sh/my-topic`. For `WEBHOOK`, any HTTPS URL your server can receive a `POST` on. Up to 500 characters either way. |
| `token` | string | No | `NTFY` only. Access token, 1 to 255 characters, for a topic that requires one to publish. |

A `WEBHOOK` request has no secret field: the signing secret is always generated on the server, never accepted from the client, and returned exactly once in the `201` response below.

```bash
curl -X POST https://your-instance.example.com/api/notifications/endpoints \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "type": "NTFY", "label": "Phone", "url": "https://ntfy.sh/my-topic" }'
```

```json
{ "endpoint": { "id": "clxendpoint1", "type": "NTFY", "label": "Phone", "url": "https://ntfy.sh/my-topic", "enabled": true, "consecutiveFailures": 0, "lastSuccessAt": null, "lastFailureAt": null, "lastFailureCode": null, "autoDisabledAt": null, "createdAt": "2026-08-27T12:00:00.000Z" } }
```

Creating a `WEBHOOK` endpoint returns the same `endpoint` object plus a `secret`, the signing key you use to verify each delivery:

```bash
curl -X POST https://your-instance.example.com/api/notifications/endpoints \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "type": "WEBHOOK", "label": "Home server", "url": "https://home.example.com/nametag" }'
```

```json
{
  "endpoint": { "id": "clxendpoint2", "type": "WEBHOOK", "label": "Home server", "url": "https://home.example.com/nametag", "enabled": true, "consecutiveFailures": 0, "lastSuccessAt": null, "lastFailureAt": null, "lastFailureCode": null, "autoDisabledAt": null, "createdAt": "2026-08-27T12:00:00.000Z" },
  "secret": "a1b2c3d4e5f6..."
}
```

`secret` is returned only this once. It is stored encrypted and there is no endpoint that reads it back afterwards; losing it means deleting the webhook and creating a new one. See [Notifications](/features/notifications/#verifying-the-signature) for the payload shape and how to verify it.

A `400` carries a machine-readable `code` alongside `error`, so a client can tell a permanent problem from a transient one instead of parsing the message text:

```json
{ "error": "That URL cannot be used", "code": "dns" }
```

`code` is one of `policy` (the URL was refused by the outbound SSRF policy: wrong protocol, disallowed port, or a private address, permanent, the URL must change), `dns` (the hostname did not resolve, possibly transient, worth retrying as-is), or `invalid` (the request body failed validation, or an ntfy topic URL has no topic segment).

A `409` also carries a `code`: `duplicate` means this exact URL is already registered to your account, distinct from the plain cap message you get when you already have 5 destinations.

In SaaS mode, creating a `WEBHOOK` endpoint without a Pro subscription returns `403`. Self-hosted instances never return this, and it is never returned for an `NTFY` endpoint.

Returns `201` on success, `400` if the body fails validation or the URL cannot be used (`code` is `dns`, `policy`, `too_long`, `not_ntfy`, `credentials_in_url`, or `invalid`), `401` if unauthenticated, `403` if creating a webhook without a Pro subscription in SaaS mode, `409` if you already have 5 destinations or that URL is already registered, `429` if rate limited.

## Update a notification endpoint

```
PUT /api/notifications/endpoints/{id}
```

Relabels a destination, enables or disables it, replaces its URL, replaces an ntfy access token, or rotates a webhook signing secret. Re-enabling clears the auto-disable state and the consecutive failure counter, so a repaired destination gets a clean slate rather than being switched off again on its next single failure. Changing the URL or the credential clears them too, since that is you asserting the previous failure no longer applies.

The destination `type` is immutable. Turning an ntfy destination into a webhook would reinterpret its stored secret as a signing key rather than a bearer token, so it can only be changed by deleting the destination and adding a new one.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | No | 1 to 60 characters. |
| `enabled` | boolean | No | |
| `url` | string | No | Re-validated exactly as at creation, including the ntfy server check, so an edit cannot reach a state creation would refuse. Draws on the same per-user outbound budget a test send does. |
| `token` | string or null | No | ntfy only. A new access token, or `null` to remove the saved one. Omitting the field leaves it unchanged. |
| `rotateSecret` | `true` | No | Webhook only. Issues a new signing secret and returns it once. |

```bash
curl -X PUT https://your-instance.example.com/api/notifications/endpoints/clxendpoint1 \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "enabled": false }'
```

```json
{ "success": true }
```

When `rotateSecret` was requested, the response also carries the new secret. This is the only time it is ever returned, the same contract as creation:

```json
{ "success": true, "secret": "9f2c..." }
```

Returns `400` for an invalid body or a URL that cannot be used, `401` if unauthenticated, `403` if re-enabling, re-pointing, or rotating the secret of a webhook without a Pro subscription in SaaS mode, `404` if the destination does not exist or belongs to another user, `409` if the new URL is already registered on another of your destinations, `429` if rate limited.

Disabling and relabelling a webhook are deliberately **not** gated on the subscription, so a lapsed subscriber can still switch off or tidy up a destination that is no longer being delivered to.

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

Sends a sample notification to one destination and reports the outcome immediately. This is the tightest rate limit in the app, since it is a synchronous, user-triggered outbound request: 5 requests per 15 minutes **per destination**, under a ceiling of 25 per 15 minutes across all of your destinations. Keying it per destination means someone at the 5-destination cap is not left with one test each per window, which is what ordinary setup looks like; the per-user ceiling is what keeps the total bounded. A failed test is reported back but never counted toward auto-disable, and the response never carries a body or status line from the destination, only the coarse failure category below.

```bash
curl -X POST https://your-instance.example.com/api/notifications/endpoints/clxendpoint1/test \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "ok": false, "code": "timeout" }
```

`code` is present only when `ok` is `false`, and is one of `blocked`, `dns`, `timeout`, `refused`, `tls`, `redirect`, `http_4xx`, `http_429`, `http_5xx`, `unexpected_response`, or `unknown`. `http_429` means the destination is rate limiting requests, which is distinct from `http_4xx` and does not count toward auto-disable. `unexpected_response` means the destination answered successfully but not in the shape the protocol expects: for ntfy, a `2xx` whose `Content-Type` is not JSON, which is what an address that is not actually an ntfy server looks like.

Entitlement is re-checked here too, not only at creation time: testing a `WEBHOOK` destination without a Pro subscription in SaaS mode returns `403`, so a downgrade stops even a manual test-send immediately.

Returns `401` if unauthenticated, `403` if testing a webhook without a Pro subscription in SaaS mode, `404` if the destination does not exist or belongs to another user, `429` if rate limited.
