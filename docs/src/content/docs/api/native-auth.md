---
title: Native app sign-in
description: How the Nametag mobile apps sign in, refresh and sign out.
sidebar:
  order: 2
---

The Nametag mobile apps use their own sign-in endpoints. They return tokens instead of a browser cookie. If you're writing your own client, use these endpoints rather than a personal API token so users never have to copy tokens around.

Call [`GET /api/server-info`](/api/overview/#server-info) first to see which sign-in methods the server offers.

## Sign in

```bash
curl -X POST https://your-instance.example.com/api/auth/native/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "you@example.com",
    "password": "…",
    "device": { "name": "Matto'\''s iPhone", "platform": "IOS", "appVersion": "1.0.0" }
  }'
```

```json
{
  "accessToken": "ntsa_…",
  "accessTokenExpiresAt": "2026-10-17T11:00:00.000Z",
  "refreshToken": "ntsr_…",
  "sessionId": "…",
  "user": { "id": "…", "email": "you@example.com", "name": "Matto" }
}
```

`platform` is `IOS` or `ANDROID`. The device name is shown to the user under **Settings > Security > Signed-in devices**.

Send the access token as `Authorization: Bearer ntsa_…` on every request. It's valid for one hour.

## Refresh

When a request returns 401 with code `access_token_expired`, exchange the refresh token for a new pair and retry:

```bash
curl -X POST https://your-instance.example.com/api/auth/native/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "ntsr_…" }'
```

The response has the same shape as sign-in. Store the new refresh token straight away: the old one stops working. If a refresh response is lost and the app retries with the old token within 60 seconds, it gets a fresh pair. A refresh token presented again after that is treated as stolen, and the device is signed out.

Send one refresh at a time. If several requests fail with `access_token_expired` together, refresh once and retry them all with the new access token. Two refreshes sent in parallel can leave only one of the returned pairs valid.

A session stays signed in for as long as the app keeps refreshing. It expires after 90 days without a refresh. A 401 with code `session_expired` means the user has to sign in again.

## Sign out

```bash
curl -X POST https://your-instance.example.com/api/auth/native/logout \
  -H "Authorization: Bearer ntsa_…"
```

Returns 204.

## Error codes

Every error body has an English `error` message and a stable `code`:

| Status | Code | Meaning |
|---|---|---|
| 400 | `validation_failed` | The request body is invalid. `details` lists the fields. |
| 400 | `not_a_device_session` | Logout was called without a device access token. |
| 401 | `invalid_credentials` | Wrong email or password. |
| 401 | `access_token_expired` | Refresh and retry. |
| 401 | `invalid_token` | The bearer token is unknown or revoked. |
| 401 | `session_expired` | Sign in again. |
| 403 | `account_locked` | Too many failed attempts. Try again in 30 minutes. |
| 403 | `email_not_verified` | Verify the email address first (hosted service only). |
| 403 | `password_login_disabled` | This server only allows single sign-on. |
| 429 | `rate_limited` | Wait for the number of seconds in `Retry-After`. |

## Password changes

Changing or resetting the password signs out every device and every browser.

## Technical details

- Device name: 1 to 100 characters. App version: 1 to 32 characters.
- Sign-in and refresh share the web login rate limit (5 attempts per 15 minutes).
- Only SHA-256 hashes of the tokens are stored.
