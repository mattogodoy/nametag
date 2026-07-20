---
title: Configuration
description: Full reference of environment variables and deployment modes.
sidebar:
  order: 2
---

Nametag is configured entirely through environment variables, typically set in a `.env` file next to your `docker-compose.yml`. This page is the full reference. For a shorter path to a running instance, see [Installation](/self-hosting/installation/).

## Deployment modes

Nametag behaves differently depending on `NODE_ENV` and `SAAS_MODE`. Almost every self-hosted instance runs in the second mode below.

### Development (`NODE_ENV=development`)

For local development and testing. Redis is optional (falls back to in-memory rate limiting), email verification is disabled, billing is hidden, and OIDC is available if configured.

### Production / self-hosted (default)

This is the default mode when `NODE_ENV` is `production` or unset, and `SAAS_MODE` is not `true`. It's what you get by following [Installation](/self-hosting/installation/).

- Redis is optional but recommended (in-memory fallback otherwise)
- New accounts are auto-verified, no email required
- Billing is hidden, all features are unlimited
- OIDC is available if configured, password login can be disabled once it is
- Google OAuth is not available (self-hosted instances use OIDC instead)

### SaaS mode (`SAAS_MODE=true`)

Reserved for the hosted service at nametag.one. Redis becomes mandatory, email verification is required, billing and usage limits are enforced, and Google OAuth is enabled instead of generic OIDC. You should not set `SAAS_MODE=true` on a self-hosted instance.

## Database configuration

Nametag supports two ways to point at your Postgres database.

**Method 1: individual variables (recommended).** Set `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and optionally `DB_PASSWORD` separately. This is the friendlier option if you're not used to connection strings.

**Method 2: connection string (advanced).** Set `DATABASE_URL=postgresql://user:password@host:5432/database` directly.

If `DATABASE_URL` is set, it takes precedence over the individual `DB_*` variables. The application requires either a complete `DATABASE_URL`, or all of `DB_HOST`, `DB_PORT`, `DB_NAME`, and `DB_USER` (with `DB_PASSWORD` optional). If neither is provided, the app refuses to start and logs a clear error.

## Required variables

| Variable | Description | Example |
| --- | --- | --- |
| `DB_HOST` | PostgreSQL server hostname | `db` or `localhost` |
| `DB_PORT` | PostgreSQL server port | `5432` |
| `DB_NAME` | PostgreSQL database name | `nametag_db` |
| `DB_USER` | PostgreSQL username | `nametag` |
| `DB_PASSWORD` | PostgreSQL password | `your-secure-password` |
| `NEXTAUTH_URL` | Application URL, used for auth, emails, and redirects | `https://yourdomain.com` |
| `NEXTAUTH_SECRET` | Secret for JWT encryption, minimum 32 characters | Generate with `openssl rand -base64 32` |
| `CRON_SECRET` | Secret for authenticating cron job requests, minimum 16 characters | Generate with `openssl rand -base64 16` |

`REDIS_URL` and `REDIS_PASSWORD` are required only in SaaS mode. For self-hosted instances they're optional. See [Redis](/self-hosting/redis/) for the full explanation of when you need it.

## Optional variables

| Variable | Description | Default |
| --- | --- | --- |
| `RESEND_API_KEY` | API key from Resend for email functionality | Not required for self-hosted |
| `EMAIL_DOMAIN` | Verified domain for sending emails, required if using Resend or SMTP | Not required for self-hosted |
| `SMTP_HOST` | SMTP server hostname, alternative to Resend | Not set |
| `SMTP_PORT` | SMTP server port, 587 for STARTTLS or 465 for SSL | Not set |
| `SMTP_SECURE` | Use SSL/TLS, `true` for port 465, `false` for 587 | `false` |
| `SMTP_USER` | SMTP username, often your email address | Not set |
| `SMTP_PASS` | SMTP password or app-specific password | Not set |
| `SMTP_REQUIRE_TLS` | Require STARTTLS | `true` |
| `SMTP_FROM` | Override the "from" address if your server rejects custom ones | Not set |
| `PHOTO_STORAGE_PATH` | Custom path for photo storage | `/app/data/photos` |
| `PHOTO_SIZE` | Photo dimensions in pixels, square, 64 to 4096 | `256` |
| `PHOTO_QUALITY` | JPEG quality for opaque photos, 1 to 100 | `80` |
| `OIDC_ISSUER_URL` | OIDC provider issuer URL, enables SSO login | Not set |
| `OIDC_CLIENT_ID` | OIDC client ID registered with your provider | Not set |
| `OIDC_CLIENT_SECRET` | OIDC client secret | Not set |
| `OIDC_DISPLAY_NAME` | Label shown on the SSO login button | `SSO` |
| `DISABLE_PASSWORD_LOGIN` | Hide the password form, requires OIDC to be fully configured | `false` |
| `DISABLE_REGISTRATION` | Disable registration after the first user | `false` |
| `GEOCODER_URL` | Nominatim-compatible geocoder used to place addresses on the map | `https://nominatim.openstreetmap.org` |
| `DISABLE_GEOCODING` | Disable all address geocoding instance-wide | `false` |
| `REDIS_URL` | Redis connection URL | Not set (in-memory fallback) |
| `REDIS_PASSWORD` | Redis authentication password | Not set |
| `NODE_ENV` | Environment mode: `development`, `production`, or `test` | `production` |
| `LOG_LEVEL` | Logging verbosity: `debug`, `info`, `warn`, or `error` | `info` |

Detailed setup for each of these areas lives on its own page:

- [Email](/self-hosting/email/): Resend and SMTP, provider-specific notes
- [Authentication](/self-hosting/authentication/): OIDC, registration control, password login
- [Redis](/self-hosting/redis/): when it's needed and how to configure it
- [Map & Geocoding](/self-hosting/map-geocoding/): geocoder configuration and privacy

## Generating secrets

`NEXTAUTH_SECRET` and `CRON_SECRET` should both be random, unique strings. Generate them with:

```bash
openssl rand -base64 32   # for NEXTAUTH_SECRET
openssl rand -base64 16   # for CRON_SECRET
```

Don't reuse the same value for both, and don't reuse secrets across instances.
