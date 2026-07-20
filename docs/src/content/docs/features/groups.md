---
title: Groups
description: Organize your contacts into color-coded categories.
sidebar:
  order: 2
---

Groups are your own categories for organizing people: family, friends, work, school, or anything else that reflects how you actually think about your network. A person can belong to as many groups as you like.

## Creating a group

A group needs a name. Description and color are optional:

- **Name**: required
- **Description**: optional, a short note about what the group is for
- **Color**: optional, picked from a hex color picker, used throughout the app to visually distinguish the group in lists and the network graph

## Assigning members

You can add people to a group in two places:

- From the **group detail page**, using the member manager to add or remove people
- From a **person's edit page**, by checking the groups they belong to

Both approaches update the same underlying membership, so it doesn't matter which one you use.

## Removing members

Removing someone from a group doesn't delete the person, it just removes that one association. You can remove members from the group detail page or by unchecking the group on the person's edit page.

## Filtering people by group

On the [People](/features/people/) page, you can filter the list down to a single group, or to people who don't belong to any group at all.

## Filtering the network graph by group

The network graph supports a richer set of group filters, since you often want to combine several groups at once:

- **Any (OR) mode**: shows people who belong to at least one of the selected groups
- **All (AND) mode**: shows only people who belong to every selected group
- **Exclusion**: any selected group can be flipped from included to excluded, hiding people who belong to it instead of showing them

In bubbles view, people who don't belong to any group are collected into their own "Ungrouped" bubble, so they're still visible even without a group of their own.

## The group detail page

Opening a group shows its name, description, color, and the full list of current members with a count, along with the tools to add or remove people.

## Tier limits

In SaaS mode, the number of groups you can create depends on your plan:

- **Free**: up to 10 groups
- **Personal**: up to 500 groups
- **Pro**: unlimited groups

Self-hosted installations are not subject to these limits.

## Soft delete

Deleting a group doesn't erase it immediately. It moves to the trash, where it can be restored within 30 days before being permanently removed. See [Trash & Restore](/features/trash/) for how recovery works.
