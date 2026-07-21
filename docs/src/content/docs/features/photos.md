---
title: Photos
description: Add and manage photos for your contacts.
sidebar:
  order: 9
---

A photo turns an entry in your network into a face you recognize. Nametag supports photos for both the people you track and your own account profile.

## Uploading a photo

On a person's edit page, click the photo area to choose an image from your device. Before it's saved, an interactive crop tool lets you adjust the crop area and zoom in or out until the framing looks right, so you don't need to pre-crop images yourself.

HEIC files (the default photo format on Apple devices) are supported. When you select a HEIC image, Nametag automatically converts it to JPEG on the server before opening the crop tool, so no manual conversion is needed.

Photos are compressed on the server for storage efficiency, so uploads stay reasonably sized regardless of the original file.

## Your own profile photo

Your account has a profile photo too, set from Settings > Profile using the same upload and crop flow used for contacts.

## When there's no photo

If a person doesn't have a photo set, their initials are shown instead, generated from their name and used consistently as a fallback avatar throughout the app.

## Where photos show up

Beyond the person's own detail and edit pages, photos appear in a few other places:

- **Network graph**: each person's photo (or initials, if none is set) is used as their node avatar
- **Global search**: photos appear next to matching people in search results, making it easier to spot the right person at a glance

## Where photos are stored

Photos are stored on disk, not in the database, at the path configured by the `PHOTO_STORAGE_PATH` environment variable. If you're running Nametag with Docker, this needs to point at a persistent volume (the `photo_data` volume defined in `docker-compose.yml`), otherwise uploaded photos will be lost the next time the container restarts. See [Configuration](/self-hosting/configuration/) for details on setting this up.

## Technical details

| Spec | Value |
| --- | --- |
| Max upload size | 50 MB |
| Accepted input formats | JPEG, PNG, GIF, WebP (native); HEIC/HEIF (auto-converted to JPEG before crop) |
| Output format | JPEG for opaque images, PNG for images with transparency |
| Output dimensions | Square, default 256x256px (configurable via the `PHOTO_SIZE` environment variable, range 64-4096) |
| JPEG quality | Default 80 (configurable via the `PHOTO_QUALITY` environment variable, range 1-100) |
| Crop aspect ratio | 1:1 (square), shown with a round crop shape in the UI |
| EXIF data | Auto-rotated, then stripped |
| Storage filename | `{personId}.jpg` or `{personId}.png`, in a per-user directory |
| Max decoded pixel count | 100 megapixels |
| Download timeout for URL-based photos | 15 seconds |
