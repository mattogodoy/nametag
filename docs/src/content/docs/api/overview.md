---
title: API Overview
description: Authentication, response format, and conventions for the Nametag API.
sidebar:
  order: 1
---

Nametag exposes a JSON REST API covering everything the web app itself uses: people, groups, relationships, journal entries, the map, dashboard stats, CardDAV sync, and account settings. If you can do it in the UI, there's almost always an API endpoint behind it.

## Base URL

All paths in this reference are relative to your Nametag instance:

```
https://your-instance.example.com
```

If you're using the hosted service, that's `https://nametag.one`. If you're self-hosting, it's whatever domain you've configured.

## Authentication

The API supports two authentication methods.

### Session cookie

When you're signed in through the browser, every request automatically carries the `authjs.session-token` cookie set by NextAuth.js. This is how the Nametag web app itself talks to the API. It's not meant for external scripts since it requires a browser login flow, but it's why the app "just works" without you thinking about tokens.

### API token

For scripts, integrations, and anything outside the browser, create a personal API token in **Settings > API Tokens** and send it as a bearer token:

```bash
curl https://your-instance.example.com/api/people \
  -H "Authorization: Bearer ntag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

API tokens work on nearly every endpoint that accepts a session cookie. The token management endpoints themselves (`/api/user/api-tokens`) are the one exception: creating and revoking tokens always requires a session, since letting a token manage other tokens would be a security hole. See [API Tokens](/api/tokens/) for scopes, expiry, and full examples.

## Response format

Every response is JSON.

Successful responses return the resource, usually wrapped in a named key that matches the resource type:

```json
{ "person": { "id": "clxyz...", "name": "Ada" } }
```

or, for list endpoints:

```json
{ "people": [ { "id": "clxyz...", "name": "Ada" } ] }
```

Errors return an `error` field with a human-readable message:

```json
{ "error": "Person not found" }
```

Validation failures (HTTP 400) additionally include a `details` array with per-field messages:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" }
  ]
}
```

## Common status codes

| Status | Meaning |
| --- | --- |
| 200 | Success |
| 201 | Resource created |
| 400 | Bad request, usually a validation error |
| 401 | Not authenticated, missing or invalid session/token |
| 403 | Forbidden, valid auth but not allowed (e.g. a plan limit or a read-only token trying to write) |
| 404 | Resource not found, or not owned by the authenticated user |
| 409 | Conflict, e.g. trying to create a second CardDAV connection |
| 413 | Payload too large, e.g. a vCard file over 2 MB |
| 429 | Rate limited, see below |
| 500 | Server error |
| 503 | Service unavailable, used by the health check when the database is unreachable |

## Rate limiting

Rate limiting applies to sensitive, unauthenticated endpoints, not to the general CRUD API. It protects things like login, registration, password reset, and CardDAV credential testing from brute-force abuse. Limits are IP-based sliding windows: for example, login allows 5 attempts per 15 minutes, and registration allows 3 attempts per hour.

Storage is Redis-backed in production when Redis is configured (falling back to an in-memory store per instance otherwise) and always in-memory in development. A `429` response includes a `Retry-After` header and a `retryAfter` field in seconds.

Everyday endpoints like `/api/people` or `/api/groups` are not rate-limited beyond your plan's usage limits.

## Pagination

Most list endpoints (people, groups, relationships, relationship types) return the full collection in one response, since personal networks are typically a few hundred people at most rather than millions of rows.

The one endpoint that paginates is journal entries. `GET /api/journal` accepts a `page` query parameter and returns a `pagination` object alongside the entries:

```json
{
  "entries": [ /* ... */ ],
  "pagination": { "page": 1, "pageSize": 50, "totalCount": 132, "totalPages": 3 }
}
```

See [Journal](/api/journal/) for details.

## Interactive docs

The API also ships with self-documenting tools you can use alongside this reference:

- **Swagger UI** at `/api/docs`, an interactive explorer where you can browse every endpoint and try requests against your own instance.
- **Raw OpenAPI spec** at `/api/openapi.json`, the machine-readable source of truth this reference is generated from.

## Quick example

List the people in your network with an API token:

```bash
curl https://your-instance.example.com/api/people \
  -H "Authorization: Bearer ntag_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

```json
{
  "people": [
    {
      "id": "clx1a2b3c",
      "name": "Ada",
      "surname": "Lovelace",
      "organization": "Analytical Engine Society",
      "groups": [],
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-15T10:00:00.000Z"
    }
  ]
}
```
