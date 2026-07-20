---
title: Search
description: Find contacts quickly with global search.
sidebar:
  order: 11
---

Nametag's global search lets you jump to any contact from anywhere in the app, without clicking through menus.

## Opening search

Press `Cmd+K` on Mac or `Ctrl+K` on Windows and Linux to open the search bar. It works from any page: your dashboard, a person's detail page, settings, wherever you happen to be.

## How it works

Search runs entirely in your browser. When you sign in, Nametag builds a search index from all your contacts using MiniSearch, a lightweight full-text search library, and caches it client-side. That means results appear instantly as you type, with no round trip to the server for every keystroke.

The index rebuilds automatically whenever you add, edit, or delete a contact, so it always reflects your current data.

## Fuzzy matching

Search tolerates typos and partial matches. Typing "jhon" will still surface "John", and a partial name like "sam" will match "Samantha" or "Samuel". You don't need to spell a name exactly right to find who you're looking for.

## Reading the results

Each result shows:

- The person's name
- Their photo, or their initials if no photo is set
- The groups they belong to

Click any result to go straight to that person's detail page.

## Technical details

- **Default max results**: 20
- **Fuzzy tolerance**: 0.2
- **Combine mode**: AND (all search words must match)
- **Prefix matching**: enabled, so results appear as you type
- **Indexed fields**: name, surname, middle name, second last name, nickname, display name override, organization, job title, notes, phones, emails, addresses, URLs, IM handles, groups, custom fields
