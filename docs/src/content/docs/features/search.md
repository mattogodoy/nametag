---
title: Search
description: Find contacts quickly with global search.
sidebar:
  order: 11
---

Nametag's global search lets you jump to any contact from anywhere in the app, without clicking through menus.

## Opening search

Press `Cmd+K` on Mac or `Ctrl+K` on Windows and Linux to open the search bar. It works from any page: your dashboard, a person's detail page, settings, wherever you happen to be.

On phones and other narrow screens, tap the magnifying glass in the header. The search field expands to fill the header and is focused straight away, so you can start typing without a second tap. The keyboard shortcut opens that same field when a keyboard is attached, and Escape or Cancel puts it away.

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

## Advanced search

When you need more than a name, open **Search** in the main navigation (or go to `/search`). The advanced search page has a separate field for each kind of detail:

- **Name**: first name, middle name, surname, second last name, nickname, or display name
- **Location**: street, city, region, postal code, or country (by name, like "Germany", or by its two-letter code, like "DE")
- **Email**: any part of an email address
- **Phone**: any part of a phone number. Spaces, dashes, and parentheses are ignored, so "612345" finds "+34 612 345 678"
- **Keywords in notes**: words that appear in the person's notes. Every word you type must appear, in any order

Fill in as many fields as you like. A person shows up only if they match every field you filled in. Matching ignores case and accents and accepts partial values, so "mad" finds "Madrid". The search lives in the page URL, so you can bookmark a search or share the link with yourself.

### Technical details

- Advanced search runs on the server and reads your contacts fresh on every search, so it does not use the browser search index
- No fuzzy matching: a field must contain the text you typed
- **Max results shown**: 200. The page tells you the total when there are more
