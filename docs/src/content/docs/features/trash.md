---
title: Trash & Restore
description: Recover deleted items within 30 days.
sidebar:
  order: 15
---

Deleting something in Nametag doesn't erase it right away. It gives you a safety net.

## Soft delete

When you delete a person, group, relationship, relationship type, or important date, it isn't removed immediately. Instead, it's moved to trash, marked as deleted but kept in the database.

## 30-day retention

Trashed items stay recoverable for 30 days from the moment they're deleted. During that window, you can bring anything back exactly as it was.

## Viewing and restoring trash

Trash is accessible from within the app and organizes items by type: people, groups, relationships, relationship types, and important dates. Find the item you want back and click **Restore** to bring it back into your active data.

## Automatic purge

A background job called `purge-deleted` runs daily at 3am and permanently removes anything that has been sitting in trash for more than 30 days. Once an item is purged this way, it's gone for good and can't be recovered.

When a person is permanently deleted, their associated data goes with them: relationships, group memberships, custom field values, and photos.
