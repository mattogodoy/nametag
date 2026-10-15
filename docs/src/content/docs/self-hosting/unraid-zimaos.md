---
title: Unraid, ZimaOS and CasaOS
description: Install Nametag from the Unraid Community Applications or ZimaOS app stores.
sidebar:
  order: 1.5
---

If your home server runs Unraid, ZimaOS or CasaOS, you can install Nametag from its app store instead of writing a `docker-compose.yml` yourself. Both listings use the same official image described in [Installation](/self-hosting/installation/).

## ZimaOS and CasaOS

CasaOS has been succeeded by ZimaOS, and both use the same app store. The app installs everything Nametag needs in one go: the app, a PostgreSQL database, and a small container that runs the [scheduled jobs](/self-hosting/cron-jobs/).

1. Open the **App Store**, search for **Nametag** and click **Install**.
2. Before confirming, open the settings and change `NEXTAUTH_URL` to the address you will open Nametag at, for example `http://192.168.1.10:10300`. Sign-in links and emails use it.
3. Open Nametag from the dashboard and create your account.
4. If other people on your network can reach the port, add `DISABLE_REGISTRATION=true` to the app's environment once your account exists.

`NEXTAUTH_SECRET`, `CRON_SECRET` and the database password are generated on first start and stored in `/DATA/AppData/nametag/data/secrets.env`. Keep that file with your backups: if you lose it, new secrets are generated and everyone is signed out, but no data is lost.

To send reminder and password-reset emails, add the `SMTP_*` variables from [Email](/self-hosting/email/) to the `nametag` container.

## Unraid

The Unraid template installs the Nametag container only. You need a PostgreSQL database running alongside it.

### 1. Set up PostgreSQL

Install a PostgreSQL container from Community Applications (the official `postgres` image, version 14 or newer, works). Create a database and user for Nametag, and note the server's IP, port, user and password.

### 2. Prepare the photo folder

The Nametag container runs as UID 1001, so its photo folder must be writable by that user. In the Unraid terminal, run:

```bash
mkdir -p /mnt/user/appdata/nametag/photos
chown -R 1001:1001 /mnt/user/appdata/nametag
```

### 3. Install Nametag

1. In **Apps**, search for **Nametag** and click **Install**.
2. Generate two secrets in the terminal with `openssl rand -base64 32`, and paste them into **Auth secret** and **Cron secret**.
3. Set **App URL** to the address you open Nametag at, for example `http://192.168.1.10:3000`.
4. Fill in the database fields from step 1 and click **Apply**.

### 4. Schedule the background jobs

Reminders, CardDAV sync, cleanup and geocoding run when something calls Nametag's [cron endpoints](/self-hosting/cron-jobs/). On Unraid, the **User Scripts** plugin can do this. Create one script per job, set it to a custom schedule, and paste:

```bash
#!/bin/bash
# Change these two values to match your install.
NAMETAG_URL="http://192.168.1.10:3000"
CRON_SECRET="your-cron-secret"

curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$NAMETAG_URL/api/cron/send-reminders"
```

| Job | Endpoint | Suggested schedule |
|---|---|---|
| Reminders | `send-reminders` | `0 8 * * *` |
| Cleanup | `purge-deleted` | `0 3 * * *` |
| CardDAV sync | `carddav-sync` | `0 2,10,18 * * *` |
| Geocoding | `geocode` | `*/5 * * * *` |

### Optional settings

Redis, SMTP and other optional settings are not in the template, because Unraid passes empty fields to the container and Nametag treats an empty value as invalid. To use one, click **Add another Path, Port, Variable, Label or Device**, choose **Variable**, and enter the name and value from [Configuration](/self-hosting/configuration/).
