---
title: Map & Geocoding
description: Configure the geocoder that powers the Map tab.
sidebar:
  order: 7
---

The [Map tab](/features/map/) shows your contacts plotted by address. To do that, Nametag needs to turn a street address into latitude and longitude, a process called geocoding. This page covers how that works for self-hosted instances and how to configure or disable it.

## How geocoding works

When you add or edit a contact's address, Nametag geocodes it right away in the background. If that immediate attempt fails (a transient network error, a rate-limited geocoder, and so on), the address is left in a pending state and picked up by a background job.

That background job runs on a schedule via `GET /api/cron/geocode`, the same cron mechanism used for reminders and CardDAV sync. See [Cron Jobs](/self-hosting/cron-jobs/) for how it's wired up in `docker-compose.yml`. Each run processes up to 50 pending or previously-failed addresses, at a rate of 1 request per second against your configured geocoder, so a full backlog clears gradually rather than hammering the geocoding service.

## The default geocoder

By default, `GEOCODER_URL` points at the public OpenStreetMap Nominatim instance:

```bash
GEOCODER_URL=https://nominatim.openstreetmap.org
```

This requires no setup and works out of the box. It's rate-limited and intended for light use; Nametag's 1 request/second cadence respects Nominatim's usage policy, but if you have a large number of contacts or want to avoid sending addresses to a third-party service at all, consider running your own instance.

## Running your own geocoder

Point `GEOCODER_URL` at any Nominatim-compatible endpoint, including a self-hosted [Nominatim](https://nominatim.org/) or [Photon](https://photon.komoot.io/) instance:

```bash
GEOCODER_URL=https://nominatim.yourdomain.com
```

This is worth doing if:

- You have a large dataset and don't want to wait through the 50-address, 1-per-second cadence against the public instance
- You'd rather keep contact addresses from leaving your own infrastructure
- You're hitting rate limits on the public instance regularly

Self-hosting Nominatim requires downloading OpenStreetMap data for the regions you care about and is a heavier piece of infrastructure than Nametag itself; consult the [Nominatim installation docs](https://nominatim.org/release-docs/latest/admin/Installation/) if you go this route. Photon is somewhat lighter to run if a smaller feature set is acceptable.

## Disabling geocoding entirely

To turn off address geocoding instance-wide, regardless of individual user settings:

```bash
DISABLE_GEOCODING=true
```

With this set, the cron endpoint returns immediately without processing anything, and new or edited addresses are never sent to a geocoder. The Map tab still exists, but contacts without existing coordinates won't appear on it.

## Per-user opt-out

Even without the instance-wide flag, individual users can turn off geocoding for their own account under **Settings > Map**. This is useful on a multi-user self-hosted instance where not everyone wants their contacts' addresses geocoded, even against your own private Nominatim instance.

## Technical specs

| Setting | Value |
| --- | --- |
| Batch size | 50 addresses per cron run |
| Rate limit | 1 request per second to the geocoder |
| Default provider | OSM Nominatim (`https://nominatim.openstreetmap.org`) |
