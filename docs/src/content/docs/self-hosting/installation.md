---
title: Installation
description: Get Nametag running on your own server with Docker.
sidebar:
  order: 1
---

Nametag ships as an official Docker image, published for both **AMD64** (x86_64) and **ARM64** (aarch64). That means it runs the same way on a cloud VM, a home server, an Apple Silicon Mac, or a Raspberry Pi.

This page gets you from nothing to a running instance. For the full list of environment variables, see [Configuration](/self-hosting/configuration/).

## Prerequisites

- Docker and Docker Compose installed on your server
- A place to put a `docker-compose.yml` and `.env` file

## Quick start

### 1. Create a project directory

```bash
mkdir nametag && cd nametag
```

### 2. Create `docker-compose.yml`

This minimal setup runs the app, a Postgres database, and a small cron container that triggers Nametag's scheduled jobs (reminders, cleanup, CardDAV sync, and geocoding).

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: ghcr.io/mattogodoy/nametag:latest
    restart: unless-stopped
    ports:
      - '3000:3000'
    env_file:
      - .env
    volumes:
      - photo_data:/app/data/photos
    depends_on:
      - db

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

volumes:
  postgres_data:
  photo_data:
```

:::caution
The `photo_data` volume is required to persist uploaded photos across container restarts and redeployments. Without it, all photos are lost the moment the `app` container is recreated.
:::

See [Cron Jobs](/self-hosting/cron-jobs/) for details on what each of these four scheduled jobs does and how to adjust the schedule.

### 3. Create `.env`

Create a `.env` file next to your `docker-compose.yml` with the required variables:

```bash
# Generate secrets with: openssl rand -base64 32

# Database connection
DB_HOST=db
DB_PORT=5432
DB_NAME=nametag_db
DB_USER=nametag
DB_PASSWORD=your-secure-database-password

# Application URL
NEXTAUTH_URL=http://localhost:3000

# NextAuth (must be at least 32 characters)
NEXTAUTH_SECRET=your-nextauth-secret-minimum-32-characters

# Cron authentication (must be at least 16 characters)
CRON_SECRET=your-cron-secret-minimum-16-characters

# Email (OPTIONAL - only needed for password resets and reminders)
# Self-hosted instances work without email - new accounts are auto-verified
```

Replace `NEXTAUTH_URL` with your real domain once you have one (for example `https://contacts.yourdomain.com`). See [Configuration](/self-hosting/configuration/) for the full variable reference, and [Email](/self-hosting/email/) if you want password resets and reminder emails.

### 4. Start the services

```bash
docker compose up -d
```

On first run, the app container waits for the database, applies all migrations automatically, and seeds the default relationship types. There's no separate setup step to run.

### 5. Open Nametag

Visit `http://localhost:3000` (or your domain, once a reverse proxy is in front of it) and register your first account. If `DISABLE_REGISTRATION` isn't set, this first account can register normally, and you can lock the instance down afterward. See [Authentication](/self-hosting/authentication/) for details.

## What's next

- [Configuration](/self-hosting/configuration/): every environment variable, explained
- [Reverse Proxy](/self-hosting/reverse-proxy/): put Nametag behind Caddy or Nginx with SSL
- [Backups](/self-hosting/backups/): protect your data once it's real
- [Upgrading](/self-hosting/upgrading/): how to pull new versions safely
