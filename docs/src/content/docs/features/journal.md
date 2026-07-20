---
title: Journal
description: Keep a timeline of notes linked to people in your network.
sidebar:
  order: 5
---

The journal is a timeline of notes and reflections, each one optionally linked to the people it's about. It's the place for things that don't belong in a person's permanent record, the small moments, conversations, and observations that build up your understanding of someone over time.

## Creating an entry

An entry has:

- **Title**: required, a short summary of what the entry is about
- **Date**: required, defaults to today. You can optionally add a time as well, if it matters when during the day something happened
- **Body**: the entry itself, written in markdown
- **Linked people**: a pill-based multi-select for tagging anyone the entry is about. An entry can mention any number of people, or none at all

When you tag at least one person, a checkbox lets you update their "last contact" date to match the entry's date, so writing a journal entry after catching up with someone can double as logging that contact in one step.

## Timeline view

The Journal page lists your entries chronologically, most recent first, grouped by month. Each entry in the list shows its title, a text preview of the body with markdown formatting stripped out, and the people it's tagged with.

## Filtering

Two filters, usable together:

- **By person**: select one or more people to narrow the list. This uses AND logic, so if you select two people, only entries that mention both of them appear, not entries mentioning either one
- **By text search**: searches both the title and the body of your entries

## Viewing on the person detail page

Every person's detail page has its own journal section showing the most recent entry that mentions them, along with links to view the full filtered timeline for that person or write a new entry directly (pre-filled with them tagged).

## Markdown support

Entry bodies support full markdown rendering: headings, bold and italic text, lists, links, blockquotes, and code. Write with the same markdown editor used elsewhere in Nametag, and it renders properly formatted wherever the entry is displayed.

## Editing and deleting entries

Open an entry to see it in full, with buttons to edit or delete it. Editing reopens the same form used to create the entry, with everything pre-filled. Deleting asks for confirmation first, since there's no undo for journal entries once you confirm.
