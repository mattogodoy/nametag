---
title: Native app sign-in
description: How the Nametag mobile apps sign in, refresh and sign out.
sidebar:
  order: 14
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

## Signed-in devices

```bash
curl https://your-instance.example.com/api/user/sessions \
  -H "Authorization: Bearer ntsa_..."
```

Returns `{ "sessions": [...] }` with each device's `id`, `name`, `platform`, `appVersion`, `lastUsedAt`, `createdAt` and `current` (true for the device making the request).

- `DELETE /api/user/sessions/{id}` signs out one device (404 if it isn't yours).
- `DELETE /api/user/sessions` signs out every device except the one making the request.

These endpoints accept a browser session or a device token, not a personal API token.

## Sign in with single sign-on

When [`/api/server-info`](/api/overview/#server-info) reports `auth.oidc.enabled` or `auth.google`, the app can sign in through the server's identity provider. Self-hosters don't need to configure anything new: the app uses the same OIDC client as the web.

1. Generate a random `state` (16 to 128 characters), a `code_verifier` (43 to 128 characters, see RFC 7636) and `code_challenge = BASE64URL(SHA256(code_verifier))`.
2. Open this URL in a private browser sheet (on iOS, `ASWebAuthenticationSession` with `prefersEphemeralWebBrowserSession`):

```
https://your-instance.example.com/api/auth/native/browser/start
  ?provider=oidc
  &state=…
  &code_challenge=…
  &code_challenge_method=S256
  &device_name=Matto%27s%20iPhone
  &platform=IOS
  &app_version=1.0.0
```

3. When sign-in finishes, the sheet is redirected to `nametag://auth/callback?code=ntc_…&state=…`. Check that `state` matches what you sent.
4. Exchange the code within 60 seconds:

```bash
curl -X POST https://your-instance.example.com/api/auth/native/browser/exchange \
  -H "Content-Type: application/json" \
  -d '{ "code": "ntc_…", "codeVerifier": "…" }'
```

The response has the same shape as password sign-in. A code works once; a wrong verifier also uses it up.

If sign-in doesn't succeed, the sheet is redirected to `nametag://auth/callback?error=…&state=…`:

| Error | Meaning |
|---|---|
| `invalid_request` | A parameter on the start URL is missing or invalid. |
| `provider_unavailable` | That sign-in method isn't enabled on this server. |
| `email_not_verified` | The identity provider hasn't verified the email address. |
| `account_linked_elsewhere` | The account signs in with a different provider. |
| `sign_in_failed` | Sign-in was cancelled or failed. |

The redirect address is always `nametag://auth/callback`; the server never redirects anywhere a request asks it to.

## Error codes

Error bodies have an English `error` message and a stable `code`. The one exception is a request with no credentials at all, which gets the plain `{ "error": "Unauthorized" }` that every endpoint returns; treat a 401 without a `code` as "sign in".

| Status | Code | Meaning |
|---|---|---|
| 400 | `validation_failed` | The request body is invalid. `details` lists the fields. |
| 400 | `not_a_device_session` | Logout was called without a device access token. |
| 401 | `invalid_code` | The single sign-on code is unknown, expired, already used, or the verifier doesn't match. |
| 401 | `invalid_credentials` | Wrong email or password. |
| 401 | `access_token_expired` | Refresh and retry. |
| 401 | `invalid_token` | The bearer token is unknown or revoked. |
| 401 | `session_expired` | Sign in again. |
| 403 | `account_locked` | Too many failed attempts. Try again in 30 minutes. |
| 403 | `email_not_verified` | Verify the email address first (hosted service only). |
| 403 | `password_login_disabled` | This server only allows single sign-on. |
| 413 | `payload_too_large` | The request body is too large. |
| 429 | `rate_limited` | Wait for the number of seconds in `Retry-After`. |
| 500 | `internal_error` | Something went wrong on the server. |
| 503 | `service_unavailable` | The server could not reach its database. Try again shortly. |

## Password changes

Resetting the password by email signs out every device and every browser. Changing it with `PUT /api/user/password` signs out every other device and browser, but a change made from the app keeps that app signed in.

## Technical details

- Device name: 1 to 100 characters. App version: 1 to 32 characters.
- Sign-in shares the web login rate limit. Refresh has its own, more generous limit.
- Only SHA-256 hashes of the tokens are stored.
