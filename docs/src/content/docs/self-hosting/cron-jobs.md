---
title: Cron Jobs
description: The four scheduled jobs that keep a Nametag instance healthy.
sidebar:
  order: 8
---

Nametag relies on four scheduled HTTP endpoints for work that can't happen inline with a user request: sending reminder emails, cleaning up old soft-deleted records, syncing CardDAV connections, and geocoding addresses. None of these are optional infrastructure you can skip entirely, though a couple degrade gracefully if you skip them (reminders and CardDAV sync just won't fire; geocoding backlogs will grow).

## How it works

Each job is a `GET` endpoint under `/api/cron/*` that requires a bearer token matching your `CRON_SECRET`:

```
Authorization: Bearer <CRON_SECRET>
```

Requests without a valid token get a `401 Unauthorized`. There's no built-in scheduler inside the Next.js app itself; something external needs to call these endpoints on a timer. The `docker-compose.yml` files shown in [Installation](/self-hosting/installation/) handle this with a small `cron` service built on `alpine:3.19`, using cron's `crond` and `wget` to hit each endpoint on schedule:

```yaml
cron:
  image: alpine:3.19
  restart: unless-stopped
  command: >
    sh -c "
      echo '0 8 * * * wget -q -O - --header=\"Authorization: Bearer '\"$$CRON_SECRET\"'\" http://app:3000/api/cron/send-reminders > /proc/1/fd/1 2>&1' > /etc/crontabs/root &&
      echo '0 3 * * * wget -q -O - --header=\"Authorization: Bearer '\"$$CRON_SECRET\"'\" http://app:3000/api/cron/purge-deleted > /proc/1/fd/1 2>&1' >> /etc/crontabs/root &&
      echo '0 2,10,18 * * * wget -q -O - --header=\"Authorization: Bearer '\"$$CRON_SECRET\"'\" http://app:3000/api/cron/carddav-sync > /proc/1/fd/1 2>&1' >> /etc/crontabs/root &&
      echo '*/5 * * * * wget -q -O - --header=\"Authorization: Bearer '\"$$CRON_SECRET\"'\" http://app:3000/api/cron/geocode > /proc/1/fd/1 2>&1' >> /etc/crontabs/root &&
      crond -f -l 2
    "
  environment:
    - CRON_SECRET=${CRON_SECRET}
  depends_on:
    - app
```

Every job logs its run to a `CronJobLog` database record (status, duration, and a summary message), so you can check job history directly in the database if a run seems to have misbehaved, even without digging through container logs.

## The four jobs

### `send-reminders`, daily at 8:00am

Endpoint: `GET /api/cron/send-reminders`

Scans for two kinds of reminders that are due: important date reminders (birthdays, anniversaries, and any other date with `reminderEnabled` set) and contact reminders (nudges based on how long it's been since `lastContact`). For each one that's due, it builds a translated email using the recipient's language preference, generates a one-click unsubscribe link, and sends the batch through [Resend or SMTP](/self-hosting/email/).

If email isn't configured on your instance, this job effectively has nothing to send and completes as a no-op. There's no error, it just skips delivery.

### `purge-deleted`, daily at 3:00am

Endpoint: `GET /api/cron/purge-deleted`

Nametag soft-deletes records (people, groups, relationships, relationship types, and important dates) so they can be recovered from [Trash](/features/trash/) within a 30-day window. This job permanently removes anything past that 30-day retention period, in an order that respects foreign key relationships: important dates first, then person-group links, relationships, groups, relationship types (clearing any dangling references along the way), and finally people. It also deletes the actual photo files on disk for any people being purged.

This is the job responsible for eventually freeing disk space and database rows tied to old deletions. Skipping it doesn't break anything immediately, but trash accumulates indefinitely.

### `carddav-sync`, three times daily (2:00am, 10:00am, 6:00pm)

Endpoint: `GET /api/cron/carddav-sync`

For every user with an active [CardDAV connection](/features/carddav/) and `syncEnabled` turned on, this job checks whether that user's configured `autoSyncInterval` has elapsed since their last sync, and if so, runs a full bidirectional sync against their server. Users who aren't due yet are skipped for that run, which is why the job can run frequently without doing redundant work.

If you don't use CardDAV at all, this job simply finds zero active connections and does nothing.

### `geocode`, every 5 minutes

Endpoint: `GET /api/cron/geocode`

Picks up to 50 addresses that are pending geocoding or previously failed, and geocodes them one at a time against your configured `GEOCODER_URL` at roughly 1 request per second (so a full batch takes under a minute). This is what backfills addresses that couldn't be geocoded immediately when they were added, and retries transient failures without giving up permanently. See [Map & Geocoding](/self-hosting/map-geocoding/) for the geocoder configuration itself.

If `DISABLE_GEOCODING=true` is set, this job returns immediately without touching the database.

## Customizing the schedule

The cron expressions above are reasonable defaults, not requirements. Feel free to adjust them:

- `send-reminders` only needs to run once a day; the time doesn't matter much beyond picking an hour when most of your users are likely to be awake to receive it.
- `purge-deleted` running once a day is plenty, since the retention window is 30 days.
- `carddav-sync` running every few hours strikes a balance between freshness and load; running it more often doesn't help unless a user's own `autoSyncInterval` is also set that low.
- `geocode` benefits from running frequently (every 1 to 5 minutes) since it only touches a small, capped batch per run and clears backlogs faster the more often it's invoked.

If you're not using Docker's `alpine` cron container, any scheduler capable of making an authenticated HTTP GET request works: system cron with `curl`, a Kubernetes `CronJob`, GitHub Actions on a schedule, or a managed cron service. The important part is including the `Authorization: Bearer <CRON_SECRET>` header on every request.
