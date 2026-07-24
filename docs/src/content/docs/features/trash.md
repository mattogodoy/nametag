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

Go to **Settings > Trash** to see all deleted items. Items are organized by type using tabs: People, Groups, Relationships, Relationship Types, and Important Dates. Each tab shows a count of deleted items.

For each item, you can see how many days remain before it's automatically purged. Click **Restore** to bring it back into your active data.

## Permanent delete

If you don't want to wait 30 days, you can permanently delete individual items from the Trash page. Click **Delete permanently** on any item and confirm the action. This is irreversible.

When a person is permanently deleted, their associated data goes with them: relationships, group memberships, custom field values, and photos.

## Automatic purge

A background job called `purge-deleted` runs daily at 3am and permanently removes anything that has been sitting in trash for more than 30 days. Once an item is purged this way, it's gone for good and can't be recovered.
