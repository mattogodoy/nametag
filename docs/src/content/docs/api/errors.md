---
title: Errors
description: Error response format and machine-readable error codes
---

Every error response from the API is JSON with an English `error` message and a stable machine-readable `code`:

```json
{
  "error": "A group with this name already exists",
  "code": "group_name_taken"
}
```

The `error` text is meant for logs and scripts. It can change between releases and is not translated. Use `code` to decide what to do or what to show a user.

Some errors also carry a `params` object with the values needed to build a localized message, for example `{ "resource": "people", "limit": 50 }` on `plan_limit_reached`. The keys depend on the code and are listed in the table below.

Some `200` validation responses also carry a `code`. For example, `POST /api/user/import/validate` returns `200` with `code: "plan_limit_reached"` and `params` next to its existing fields when the import would exceed the plan.

## Unknown codes

New codes are added over time. If a client meets a code it does not know, it should fall back to the generic code for the HTTP status: `400` is `bad_request`, `401` is `unauthorized`, `403` is `forbidden`, `404` is `not_found`, `409` is `conflict`, `413` is `payload_too_large`, `429` is `rate_limited`, `500` is `internal_error` and `503` is `service_unavailable`. Any other `4xx` falls back to `bad_request` and any other `5xx` (such as the `502` of `carddav_unreachable`) to `internal_error`.

## Stability

A code is never renamed, removed or reused once it has shipped, and its HTTP status does not change. From this version on, existing response fields such as `error` and `details` keep their shape, and new information arrives as new codes or new `params` keys. The release that introduced codes moved a few top-level fields into `params` (`retryAfter` on the password reset and verification email cooldowns, `path` on unknown API routes, `available` and `requested` on import limits) and replaced the import code `LIMIT_EXCEEDED` with `plan_limit_reached`.

## Validation errors

A `validation_failed` response keeps the legacy `details` array (`field` and `message`) and adds a `fields` array that clients can localize:

```json
{
  "error": "Validation failed",
  "code": "validation_failed",
  "details": [{ "field": "phones.0.number", "message": "Too big" }],
  "fields": [
    { "path": "phones.0.number", "issue": "too_long", "params": { "max": 50 } }
  ]
}
```

Each entry has a `path` (dot-separated, array indexes as numbers), an `issue` and optional numeric `params`. The `issue` is one of:

| Issue | Meaning |
| --- | --- |
| `required` | The field is missing. An empty string is reported as `too_short` with `params.min`. |
| `too_long` | The value is longer than allowed. `params.max` gives the limit. |
| `too_short` | The value is shorter than required. `params.min` gives the limit. |
| `invalid_format` | The value does not have the expected format, such as an email address or URL. |
| `invalid_value` | The value is not acceptable for any other reason. |

## Error codes

| Code | Status | Description | Params |
| --- | --- | --- | --- |
| `bad_request` | 400 | The request could not be processed. |  |
| `unauthorized` | 401 | Authentication is missing or invalid. |  |
| `forbidden` | 403 | The caller may not perform this action. |  |
| `not_found` | 404 | The resource does not exist or is not visible to the caller. | `path` (unknown API routes only) |
| `conflict` | 409 | The request conflicts with the current state. |  |
| `payload_too_large` | 413 | The request body is too large. |  |
| `rate_limited` | 429 | Too many requests. Retry after the Retry-After header. | `retryAfter` (password reset and verification email cooldowns) |
| `internal_error` | 500 | Unexpected server error. |  |
| `service_unavailable` | 503 | A dependency such as the database is unavailable. |  |
| `validation_failed` | 400 | The body failed validation. See fields. |  |
| `invalid_json` | 400 | The body is not valid JSON. |  |
| `invalid_origin` | 403 | The request origin is not allowed. |  |
| `invalid_query` | 400 | A query parameter is invalid. | `param` |
| `sync_cursor_expired` | 410 | The sync cursor is older than retained deletions. Discard the local cache and sync again from cursor `0`. |  |
| `invalid_credentials` | 401 | Wrong email or password. |  |
| `account_locked` | 403 | Too many failed sign-ins; the account is temporarily locked. |  |
| `email_not_verified` | 403 | The email address has not been verified. |  |
| `password_login_disabled` | 403 | Password sign-in is disabled on this server. |  |
| `session_expired` | 401 | The device session expired or was revoked. |  |
| `invalid_token` | 401 | The bearer token is unknown or malformed. |  |
| `access_token_expired` | 401 | The access token expired. Refresh it. |  |
| `invalid_code` | 401 | The sign-in code is unknown, expired or the verifier does not match. |  |
| `interactive_session_required` | 403 | This action needs a browser or device session, not an API token. |  |
| `not_a_device_session` | 400 | The caller is not a device session. |  |
| `plan_limit_reached` | 403 | The plan limit for a resource is reached. | `resource`, `limit`; imports also send `available`, `requested` |
| `subscription_required` | 403 | An active paid subscription is required. |  |
| `group_name_taken` | 409 | A group with this name already exists. |  |
| `relationship_type_name_taken` | 409 | A relationship type with this name already exists. | `name` |
| `custom_field_name_taken` | 409 | A custom field with this name already exists. |  |
| `important_date_type_exists` | 409 | The person already has a date of this type. | `type` |
| `relationship_exists` | 409 | This relationship already exists. |  |
| `email_in_use` | 409 | The email address is already used by another account. |  |
| `already_group_member` | 409 | The person is already in this group. |  |
| `self_relationship` | 400 | A person cannot be related to, or dismissed with, themselves. |  |
| `relationship_type_required` | 400 | A relationship type is required. |  |
| `invalid_person_ids` | 400 | One or more person IDs are invalid. |  |
| `name_needs_alphanumeric` | 400 | The name must contain at least one letter or digit. |  |
| `reorder_incomplete` | 400 | A reorder must include every active item exactly once. |  |
| `invalid_confirmation` | 400 | The confirmation text does not match. |  |
| `wrong_password` | 400 | The password is incorrect. |  |
| `password_required` | 400 | A password is required. |  |
| `oauth_account_no_password` | 400 | The account signs in with a provider and has no password. |  |
| `photo_missing` | 400 | No photo file was provided. |  |
| `photo_too_large` | 413 | The photo is too large. | `maxBytes` |
| `unsupported_file_type` | 400 | The file type is not supported here. |  |
| `invalid_vcard` | 400 | The vCard file could not be parsed. |  |
| `feature_disabled` | 403 | The feature is turned off. | `feature`, `scope` |
| `conflict_already_resolved` | 409 | The sync conflict was already resolved. |  |
| `carddav_auth_failed` | 400 | The CardDAV server rejected the credentials. |  |
| `carddav_unreachable` | 502 | The CardDAV server could not be reached or failed. |  |
| `invalid` | 400 | Notification endpoint: the request or URL is invalid. |  |
| `duplicate` | 409 | Notification endpoint: that destination is already added. |  |
| `dns` | 400 | Notification endpoint: the host name did not resolve. |  |
| `policy` | 400 | Notification endpoint: the address is not allowed. |  |
| `blocked` | 400 | Notification endpoint: the address is blocked. |  |
| `credentials_in_url` | 400 | Notification endpoint: the URL contains a username or password. |  |
| `not_ntfy` | 400 | Notification endpoint: the server is not an ntfy server. |  |
| `too_long` | 400 | Notification endpoint: the URL is too long. |  |
| `endpoint_limit_reached` | 409 | Notification endpoint: the per-user limit is reached. | `limit` |
