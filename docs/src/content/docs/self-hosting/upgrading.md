---
title: Upgrading
description: How to safely pull and apply new Nametag releases.
sidebar:
  order: 10
---

Nametag releases follow [semantic versioning](https://semver.org), with every release published on [GitHub Releases](https://github.com/mattogodoy/nametag/releases) alongside a changelog entry. The project is under active development and can introduce breaking changes between releases, so it's worth reading the release notes before upgrading rather than pulling `latest` blindly on a schedule.

## Available image tags

Each release publishes a multi-arch (AMD64 and ARM64) image under several tags:

| Tag | What it points to |
| --- | --- |
| `latest` | The most recent release |
| `0.53.0` (a version number) | That specific release, pinned |
| A short commit SHA | The exact commit that release was built from |
| A build timestamp | The exact build time, mostly useful for debugging |

For most self-hosted instances, pin to a specific version tag (`ghcr.io/mattogodoy/nametag:0.53.0`) rather than `latest`. This makes upgrades a deliberate action: you choose when to move to a new version after reading its release notes, instead of getting it automatically the next time the container restarts.

## Standard upgrade procedure

1. **Read the release notes.** Check the [releases page](https://github.com/mattogodoy/nametag/releases) for the version you're moving to, and anything in between if you're jumping multiple versions. Look specifically for breaking changes or new required environment variables.
2. **Take a backup.** Back up the database and photo volume before upgrading. See [Backups](/self-hosting/backups/) for the exact commands. This is the single most important step; skip everything else on this list if you must, but not this one.
3. **Update the image tag** in your `docker-compose.yml`, from your current pinned version (or `latest`) to the version you're upgrading to.
4. **Pull and recreate:**

   ```bash
   docker compose pull app
   docker compose up -d app
   ```

5. **Watch the startup logs:**

   ```bash
   docker compose logs -f app
   ```

   Confirm the database migration step completes successfully before considering the upgrade done.

## Automatic migrations

You don't run migrations manually. On every container start, `docker-entrypoint.sh` waits for the database to become reachable, then runs `npx prisma migrate deploy` automatically before starting the app. This applies any pending migrations included in that release, in order, and is safe to run repeatedly: if there's nothing new to apply, it's a no-op.

This means a normal upgrade is just "change the tag, pull, restart." There's no separate migration command to remember, and no window where the app is running against an out-of-date schema.

## Checking the health endpoint

After an upgrade, confirm the app is actually healthy rather than just "container running":

```bash
curl http://localhost:3000/api/health
```

A healthy instance returns `200` with a JSON body reporting `"status": "healthy"` and database connectivity. A `503` with `"status": "unhealthy"` usually means the database connection failed, worth checking before assuming the upgrade itself is the problem. See [Troubleshooting](/self-hosting/troubleshooting/) for what to do if it stays unhealthy.

## Version pinning vs. `latest`

Running `latest` means every `docker compose pull && docker compose up -d` picks up whatever was most recently released, without you explicitly choosing to. That's convenient if you're comfortable following the project closely, but it also means an unattended restart (say, from a host reboot) could apply a new version's migrations without you having read its release notes first.

Pinning a version tag avoids that: you only move forward when you edit the tag in your compose file yourself. Given the "active development, may introduce breaking changes" notice on the project, pinning is the safer default for anyone who isn't actively watching the release feed.

## Rolling back

If an upgrade causes problems, rolling back means:

1. Stop the app: `docker compose stop app`
2. Change the image tag back to your previous pinned version
3. Restore the database backup you took before upgrading, since a newer version may have applied migrations that the older code doesn't expect. See [Backups](/self-hosting/backups/) for the restore commands.
4. Start the app again: `docker compose up -d app`

Rolling back the container image alone, without restoring the database, only works safely if the migrations applied by the newer version are backward-compatible with the older schema expectations, which isn't guaranteed. Treat a rollback as "restore the last known-good backup," not just "swap the tag back."
