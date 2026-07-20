---
title: Import & Export
description: Move your data in and out of Nametag.
sidebar:
  order: 12
---

Your data is always yours. Nametag supports exporting and importing your contacts in two formats: a complete JSON backup, and the standard vCard format used by most contacts apps.

## JSON export

Go to **Settings > Account > Export Data**. This exports a complete snapshot of your data as a single JSON file, including:

- All people, with every sub-field: contact details, addresses, custom fields, important dates, and more
- Groups
- Relationship types
- Journal entries
- Custom field templates

You can optionally filter the export to only include people in specific groups, useful if you want a partial backup or want to share a subset of your network.

Use JSON export for backups and for moving your data between Nametag instances.

## JSON import

Go to **Settings > Account > Import Data** and upload a previously exported JSON file. Before anything is imported, Nametag shows a validation preview with counts of what will be brought in (people, groups, and so on), and the server validates the file's structure to make sure it's a well-formed Nametag export.

You can choose which groups to import. Only people who belong to at least one selected group are imported, along with the relationships between them.

## vCard import

Also from **Settings > Account > Import Data**, you can upload a `.vcf` file containing one or more contacts. Nametag maps standard vCard fields to its own: `FN`, `N`, `TEL`, `EMAIL`, `ADR`, `BDAY`, `ORG`, `TITLE`, `NOTE`, and others. Multi-contact vCard files are supported, up to 2MB per file.

This is the easiest way to bring contacts in from another app that can export vCards, without needing a Nametag-specific export first.

## vCard export

You can export contacts as standard vCard 4.0 files from a person's detail page, or in bulk for many contacts at once. Photos are included by URL reference. The resulting file works with any app that reads vCards, not just Nametag.

## Data portability

Export everything as JSON to back up or move to another Nametag instance. Export as vCard to take your contacts anywhere that speaks the format. Either way, your data never gets stuck.

## Size limits

| Import/export type | Limit |
| --- | --- |
| JSON import | 5 MB max |
| vCard import (text paste) | 2 MB max |
| vCard import (file upload) | 2 MB max |
| JSON export | no size limit, generates a full dump |
