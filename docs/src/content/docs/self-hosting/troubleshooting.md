---
title: Troubleshooting
description: Common self-hosting issues and how to diagnose them.
sidebar:
  order: 11
---

Common problems self-hosters run into, and where to look first.

## Database connection issues

**Symptom:** the app container restarts repeatedly, or logs show `Database failed to become ready after 30 attempts`.

- Confirm `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` (or `DATABASE_URL`) are all correct and match what the `db` service is actually configured with in `docker-compose.yml`.
- If `db` and `app` are separate Compose services, `DB_HOST` should be the service name (`db`), not `localhost`. `localhost` inside the `app` container refers to the app container itself, not your host machine or the database container.
- Check the database container is actually up: `docker compose ps db`. If it's restarting, check `docker compose logs db` for a Postgres-level error, often a bad password or a corrupted volume.
- Confirm neither `DATABASE_URL` nor the individual `DB_*` variables are only partially set. Nametag requires either a complete `DATABASE_URL` or all of `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` together; a partial set of either fails validation at startup with a clear error in the logs.

## Email not sending

**Symptom:** password reset emails or reminders never arrive.

- Email is optional. If you haven't configured `RESEND_API_KEY` or `SMTP_HOST`, this is expected, not a bug. See [Email](/self-hosting/email/).
- If using SMTP, check `docker compose logs app` around the time the email should have sent for an authentication or connection error from the mail server.
- Gmail and similar providers reject login with your normal password if 2FA is enabled; you need an app-specific password in `SMTP_PASS`. See [Email](/self-hosting/email/#setting-up-a-gmail-app-password).
- An error like "Sender address rejected: not owned by user" means your SMTP provider doesn't allow the `from` address Nametag is trying to use. Set `SMTP_FROM` to an address you actually control.
- Reminder emails specifically only send if the relevant [cron job](/self-hosting/cron-jobs/) (`send-reminders`) is actually running on a schedule. Confirm your `cron` container or scheduler is up and successfully hitting the endpoint, not just that email is configured.

## OIDC / SSO login errors

**Symptom:** clicking the SSO button fails, or the app won't start after enabling OIDC.

- All three of `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` must be set together. Partially configuring OIDC leaves it disabled rather than half-working.
- The app refuses to start entirely if `DISABLE_PASSWORD_LOGIN=true` is set without a complete OIDC configuration. If startup fails right after adding that flag, double-check all three OIDC variables are present and correct first.
- Confirm your provider serves a working discovery document at `{OIDC_ISSUER_URL}/.well-known/openid-configuration`. Fetch that URL directly to confirm it responds before assuming Nametag's side is broken.
- The callback URL registered with your provider must be exactly `{NEXTAUTH_URL}/api/auth/callback/oidc`. A mismatch here (wrong scheme, missing path, trailing slash difference) is one of the most common causes of a failed login redirect.
- If `NEXTAUTH_URL` doesn't match the URL you're actually accessing the app through (for example, you're behind a reverse proxy but `NEXTAUTH_URL` still says `http://localhost:3000`), fix that first. See [Reverse Proxy](/self-hosting/reverse-proxy/).

## Photos disappearing after a restart or upgrade

**Symptom:** uploaded photos vanish after `docker compose up -d` or an upgrade.

This almost always means the `photo_data` volume isn't actually mounted, or was accidentally removed. Check your `docker-compose.yml` includes:

```yaml
app:
  volumes:
    - photo_data:/app/data/photos
```

and that `photo_data` is declared under the top-level `volumes:` section. Run `docker volume ls` to confirm the volume exists and persists across `docker compose down` (without `-v`) and `docker compose up -d` cycles. If you ever run `docker compose down -v`, that removes named volumes including `photo_data`, taking every photo with it; avoid `-v` unless you specifically intend to wipe data.

## Memory usage

Nametag is a standard Next.js application; memory needs scale modestly with concurrent users and network size, not with total contacts stored (data lives in Postgres, not in the app's memory). If you're seeing the `app` container get OOM-killed on a small VPS or Raspberry Pi, check `docker stats` during normal use, and consider setting a memory limit with headroom in `docker-compose.yml` rather than leaving it unbounded, so a spike causes a clean restart instead of taking down other services on the same host.

## Checking instance health

```bash
curl http://localhost:3000/api/health
```

Returns `200` with `"status": "healthy"` when the app can reach the database. Returns `503` with `"status": "unhealthy"` and an error message when it can't, useful for confirming whether a problem is actually database connectivity before digging elsewhere. This same endpoint is what Docker's built-in `healthcheck` on the `app` service polls to decide whether the container is ready.

## Increasing log verbosity

Set `LOG_LEVEL=debug` in your `.env` and restart the app to get more detailed logs, useful when diagnosing something that isn't reproducing clearly at the default `info` level:

```bash
LOG_LEVEL=debug
```

Remember to set it back to `info` afterward; `debug` is noisy and not meant to run permanently in production.

## Common Docker issues

- **"port is already allocated"**: something else on the host is already using port 3000 (or 5432, or 6379). Either stop that service or change the host-side port mapping, for example `"3001:3000"`.
- **Changes to `.env` not taking effect**: environment variables are read at container start, not live. After editing `.env`, run `docker compose up -d app` to recreate the container with the new values; a plain `restart` reuses the old environment.
- **`docker compose pull` doesn't seem to update anything**: confirm you're pulling the tag you think you are. If your `docker-compose.yml` still says `:latest` and you've been running it a while, `docker images` will show whether a newer image was actually downloaded versus reusing a cached layer.
- **First run seems to hang**: on first start, the app waits for the database, then runs migrations and the production seed. This can take a little longer than a normal restart. Watch `docker compose logs -f app` rather than assuming it's stuck.

## Still stuck

Open an issue on [GitHub](https://github.com/mattogodoy/nametag/issues) with your `docker compose logs app` output (redact secrets first) and a description of what you expected versus what happened. For anything security-sensitive, see [SECURITY.md](https://github.com/mattogodoy/nametag/blob/master/SECURITY.md) in the repository instead of filing a public issue.
