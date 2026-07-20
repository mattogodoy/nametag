---
title: User
description: API endpoints for profile information, preferences, photo, and account deletion.
sidebar:
  order: 11
---

These endpoints manage the authenticated user's own profile, display preferences, and account. For data export/import, see [Import & Export](/api/import-export/). For API tokens, see [API Tokens](/api/tokens/).

All endpoints require authentication and operate only on the authenticated user's own account.

## Profile

### Get current user profile

```
GET /api/user/profile
```

```bash
curl https://your-instance.example.com/api/user/profile \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{
  "user": {
    "id": "clxuser1",
    "email": "ada@example.com",
    "name": "Ada",
    "surname": "Lovelace",
    "theme": "DARK",
    "dateFormat": "MDY",
    "language": "en",
    "graphMode": "individuals",
    "emailVerified": true
  }
}
```

### Update user profile

```
PUT /api/user/profile
```

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Required, 1-100 characters. |
| `surname` | string or null | |
| `nickname` | string or null | |
| `email` | string | Required, valid email. |

If `email` changes, a verification email is sent and the account is marked unverified until confirmed.

```bash
curl -X PUT https://your-instance.example.com/api/user/profile \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Ada", "surname": "Lovelace", "email": "ada@example.com" }'
```

```json
{ "user": { "id": "clxuser1", "email": "ada@example.com" }, "emailChanged": false }
```

## Password

### Change password

```
PUT /api/user/password
```

| Field | Type | Notes |
| --- | --- | --- |
| `currentPassword` | string | Required. |
| `newPassword` | string | Required. Min 8 characters, must include uppercase, lowercase, a number, and a special character. |

```bash
curl -X PUT https://your-instance.example.com/api/user/password \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "currentPassword": "OldPass1!", "newPassword": "NewPass2@" }'
```

```json
{ "message": "Password updated" }
```

## Preferences

Each preference has its own small PUT endpoint. All return the updated `user` object (except language, see below).

### Update theme

```
PUT /api/user/theme
```

Body: `{ "theme": "LIGHT" | "DARK" }`

```bash
curl -X PUT https://your-instance.example.com/api/user/theme \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "theme": "DARK" }'
```

### Update date format

```
PUT /api/user/date-format
```

Body: `{ "dateFormat": "MDY" | "DMY" | "YMD" }`

### Update name display order

```
PUT /api/user/name-order
```

Body: `{ "nameOrder": "WESTERN" | "EASTERN" }`

### Update name display format

```
PUT /api/user/name-display-format
```

Body: `{ "nameDisplayFormat": "FULL" | "NICKNAME_PREFERRED" | "SHORT" }`

### Update network-graph display mode

```
PUT /api/user/graph-display
```

Body: `{ "graphMode": "individuals" | "bubbles" }`

```bash
curl -X PUT https://your-instance.example.com/api/user/graph-display \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "graphMode": "bubbles" }'
```

### Update address geocoding preference

```
PUT /api/user/geocoding
```

Body: `{ "geocodingEnabled": true }`. Re-enabling queues previously skipped addresses for the background geocoder.

```json
{ "user": { "id": "clxuser1", "geocodingEnabled": true } }
```

### Update language

```
PUT /api/user/language
```

Body: `{ "language": "en" | "es-ES" | "ja-JP" | "nb-NO" | "de-DE" }`

```bash
curl -X PUT https://your-instance.example.com/api/user/language \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "language": "es-ES" }'
```

```json
{ "success": true, "language": "es-ES" }
```

## Photo

### Upload or replace user photo

```
POST /api/user/photo
```

`multipart/form-data` with a `photo` field. Cropped to 256x256, converted to JPEG, EXIF stripped.

```bash
curl -X POST https://your-instance.example.com/api/user/photo \
  -H "Authorization: Bearer ntag_xxx" \
  -F "photo=@ada.jpg"
```

```json
{ "photo": "clxuser1-a1b2c3.jpg" }
```

### Remove user photo

```
DELETE /api/user/photo
```

```bash
curl -X DELETE https://your-instance.example.com/api/user/photo \
  -H "Authorization: Bearer ntag_xxx"
```

```json
{ "message": "Photo deleted" }
```

### Get current user photo

```
GET /api/photos/user
```

```bash
curl https://your-instance.example.com/api/photos/user \
  -H "Authorization: Bearer ntag_xxx" \
  -o me.jpg
```

## Account deletion

```
DELETE /api/user/delete
```

Permanently deletes the account and all associated data. This cannot be undone.

| Field | Type | Notes |
| --- | --- | --- |
| `password` | string | Required for credential-based accounts (not OAuth/OIDC). |
| `confirmationText` | string | Required, must be exactly `"DELETE"`. |

```bash
curl -X DELETE https://your-instance.example.com/api/user/delete \
  -H "Authorization: Bearer ntag_xxx" \
  -H "Content-Type: application/json" \
  -d '{ "password": "CurrentPass1!", "confirmationText": "DELETE" }'
```

```json
{ "message": "Account deleted" }
```
