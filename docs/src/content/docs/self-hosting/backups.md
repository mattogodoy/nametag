---
title: Backups
description: Back up your database, photos, and how to restore from a backup.
sidebar:
  order: 9
---

Nametag stores everything that matters in two places: the Postgres database (people, relationships, groups, journal entries, settings) and the photo storage volume (profile photos). Both need to be backed up. Neither is optional to protect: losing the database means losing your entire network, and losing photos means losing every uploaded picture even if the database record for each person survives.

## Automated database backups

The production `docker-compose.yml` includes a `backup` service using [`prodrigestivill/postgres-backup-local`](https://github.com/prodrigestivill/postgres-backup-local), which runs `pg_dump` on a schedule and manages retention automatically:

```yaml
backup:
  image: prodrigestivill/postgres-backup-local
  restart: always
  environment:
    - POSTGRES_HOST=db
    - POSTGRES_DB=${DB_NAME}
    - POSTGRES_USER=${DB_USER}
    - POSTGRES_PASSWORD=${DB_PASSWORD}
    - SCHEDULE=@daily
    - BACKUP_KEEP_DAYS=7
    - BACKUP_KEEP_WEEKS=4
    - BACKUP_KEEP_MONTHS=6
    - HEALTHCHECK_PORT=8080
  volumes:
    - ./backups:/backups
  depends_on:
    - db
```

With the default settings, this keeps 7 daily backups, 4 weekly backups, and 6 monthly backups in the `./backups` directory on the host, pruning older ones automatically. Adjust `SCHEDULE` (standard cron syntax) and the `BACKUP_KEEP_*` values to match how much history you want to retain.

Because backups land in a host-mounted directory (`./backups`) rather than a Docker volume, make sure that directory itself is included in whatever off-server backup strategy you use, rsync to another machine, a cloud storage sync, and so on. A backup that only lives on the same disk as the database doesn't protect you against disk failure.

## Manual database backup

If you'd rather not run the dedicated backup service, or want an on-demand snapshot before an upgrade, run `pg_dump` directly against the `db` container:

```bash
docker compose exec db pg_dump -U ${DB_USER} -d ${DB_NAME} -F c -f /tmp/nametag_backup.dump
docker compose cp db:/tmp/nametag_backup.dump ./nametag_backup_$(date +%Y%m%d).dump
```

The `-F c` flag produces a compressed, custom-format dump that restores with `pg_restore` rather than plain SQL. For a plain SQL dump instead:

```bash
docker compose exec db pg_dump -U ${DB_USER} -d ${DB_NAME} > nametag_backup_$(date +%Y%m%d).sql
```

## Backing up photos

Uploaded photos live in the `photo_data` Docker volume, mounted at `/app/data/photos` inside the `app` container. Back up the volume itself:

```bash
docker run --rm \
  -v nametag_photo_data:/photos \
  -v "$(pwd)/backups":/backup \
  alpine tar czf /backup/photos_$(date +%Y%m%d).tar.gz -C /photos .
```

Adjust the volume name (`nametag_photo_data` above) to match what `docker volume ls` shows for your project; Compose prefixes volume names with the project directory name by default.

## Data export as a supplement

Nametag also supports exporting your data as a user, through [Import & Export](/features/import-export/): a complete JSON backup, or the standard vCard format. This is a useful supplement, especially for verifying your data is intact and portable, but it isn't a substitute for database backups. A JSON or vCard export captures a single user's contacts, not the full multi-user database state, journal entries tied to other data, cron job history, or CardDAV sync state.

## Restoring from a backup

### Restoring the database

Stop the app first so nothing writes to the database mid-restore:

```bash
docker compose stop app cron
```

Restore a custom-format dump:

```bash
docker compose exec -T db pg_restore -U ${DB_USER} -d ${DB_NAME} --clean --if-exists < nametag_backup_20260101.dump
```

Or a plain SQL dump:

```bash
docker compose exec -T db psql -U ${DB_USER} -d ${DB_NAME} < nametag_backup_20260101.sql
```

Then restart:

```bash
docker compose up -d
```

### Restoring photos

```bash
docker run --rm \
  -v nametag_photo_data:/photos \
  -v "$(pwd)/backups":/backup \
  alpine sh -c "rm -rf /photos/* && tar xzf /backup/photos_20260101.tar.gz -C /photos"
```

### After a restore

Restart the full stack and check `docker compose logs app` to confirm migrations still apply cleanly and the app starts without errors. If you restored a database dump that's older than the currently running image, the automatic migration step in `docker-entrypoint.sh` brings the schema up to date on startup, the same way it does on any fresh install.

## Before upgrading

Take a fresh database and photo backup before every upgrade, not just on a schedule. See [Upgrading](/self-hosting/upgrading/) for the full procedure and why this matters more than it might seem.
