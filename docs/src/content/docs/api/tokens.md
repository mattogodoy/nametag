---
title: API Tokens
description: Create, scope, and revoke personal API tokens for programmatic access.
sidebar:
  order: 2
---

API tokens let you script against Nametag without a browser session. Create one in **Settings > API Tokens**, or through the API itself once you're signed in.

## How tokens work

- Tokens are prefixed `ntag_` so they're recognizable at a glance (in logs, in a `.env` file, wherever they end up).
- The plaintext token is shown exactly once, at creation time. Nametag stores only a SHA-256 hash, so if you lose it, you'll need to revoke it and create a new one.
- Each token has a **scope**: `READ` or `READ_WRITE`.
- Tokens can optionally expire. An expired or revoked token is rejected the same way an invalid one is.
- Managing tokens (listing, creating, revoking) always requires a session cookie. A token can never be used to create or revoke other tokens.

### Scopes

| Scope | Behavior |
| --- | --- |
| `READ_WRITE` | Full access, same as a session cookie: GET, POST, PUT, DELETE. |
| `READ` | Restricted to safe methods: `GET`, `HEAD`, and `OPTIONS`. Any write attempt returns `403 Forbidden`. |

Use `READ` scope for anything that only needs to pull data, such as a read-only dashboard or export script, so a leaked token can't modify or delete your contacts.

### Token format

| Property | Detail |
| --- | --- |
| Format | `ntag_` prefix followed by 32 random bytes, hex-encoded (69 characters total) |
| Storage | Only a SHA-256 hash of the full token is stored; the `ntag_` prefix plus a short fragment is kept in plaintext so a token can be identified in a list without ever storing the secret itself |
| Scopes | `READ`, `READ_WRITE` |

Because the full token is never stored, there's no way for Nametag (or anyone with database access) to recover a lost token. Losing it means revoking it and creating a new one.

## Endpoints

### List API tokens

```
GET /api/user/api-tokens
```

Session (cookie) auth only. Never returns the secret value, only metadata.

```bash
curl https://your-instance.example.com/api/user/api-tokens \
  --cookie "authjs.session-token=..."
```

```json
{
  "tokens": [
    {
      "id": "clxtok1",
      "name": "Backup script",
      "prefix": "ntag_a1b2c3d4",
      "scope": "READ",
      "lastUsedAt": "2026-07-18T09:12:00.000Z",
      "expiresAt": null,
      "createdAt": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

### Create an API token

```
POST /api/user/api-tokens
```

Session (cookie) auth only. Returns the plaintext token in the `token` field, once.

**Request body**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | 1-100 characters. |
| `scope` | `READ` \| `READ_WRITE` | No | Defaults to `READ_WRITE`. |
| `expiresAt` | ISO 8601 string or `null` | No | Omit or set `null` for a token that never expires. |

```bash
curl -X POST https://your-instance.example.com/api/user/api-tokens \
  --cookie "authjs.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backup script",
    "scope": "READ",
    "expiresAt": null
  }'
```

```json
{
  "apiToken": {
    "id": "clxtok1",
    "name": "Backup script",
    "prefix": "ntag_a1b2c3d4",
    "scope": "READ",
    "lastUsedAt": null,
    "expiresAt": null,
    "createdAt": "2026-07-20T12:00:00.000Z",
    "token": "ntag_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
  }
}
```

Copy the `token` value now. It's never shown again.

### Revoke an API token

```
DELETE /api/user/api-tokens/{id}
```

Session (cookie) auth only. Permanently deletes the token; any client using it starts getting `401` immediately.

```bash
curl -X DELETE https://your-instance.example.com/api/user/api-tokens/clxtok1 \
  --cookie "authjs.session-token=..."
```

```json
{ "success": true }
```

## Using a token

Send it as a bearer token on any request:

```bash
curl https://your-instance.example.com/api/people \
  -H "Authorization: Bearer ntag_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

If the token is invalid, expired, or revoked, you'll get:

```json
{ "error": "Unauthorized" }
```

with a `401` status.
