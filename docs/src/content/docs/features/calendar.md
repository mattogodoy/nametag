---
title: Calendar
description: See birthdays, anniversaries, and other important dates in a monthly calendar.
sidebar:
  order: 20
---

The Calendar tab shows your [important dates](/features/important-dates/) laid out by month, so you can see at a glance whose birthday or anniversary is coming up and when.

## Browsing months

The calendar opens on the current month. Use the arrows next to the month name to move one month back or forward, and the **Today** button to jump back to the current month. The selected month is part of the address (`/calendar?month=2026-05`), so you can bookmark or share a link to a specific month.

On wide screens the month is a grid with one cell per day. On narrow screens, where seven columns would be too tight to read, it becomes a list of the days that have something on them.

The first day of the week follows your language. Today is highlighted.

## What shows up

Every event links to the person it belongs to. The calendar lists:

- **Important dates**: all of them, whether or not they have a reminder turned on. Birthdays, anniversaries, name days, and memorials repeat every year. A custom date, such as "First met", appears only on the day it was saved, unless you gave it a recurring reminder (see below).
- **Contact reminders**: the day a [contact reminder](/features/contact-reminders/) falls due, counted from the last time you were in touch. A person you have never recorded contact with has no due day, so nothing shows for them.

### Dates with a recurring reminder

A custom date with a recurring reminder appears on every occurrence in the month you are looking at, following the interval you set:

- **Years**: on the same day every N years
- **Months**: on the same day of the month every N months, using the last day of shorter months
- **Weeks and days**: every N weeks or days counted from the saved date

### Special cases

- **No year**: a date saved without a year repeats every year, in any year you browse to.
- **Before the start year**: a birthday does not appear in years before the year it was saved with.
- **February 29**: in years that are not leap years, a February 29 date appears on March 1, the same day its reminder is sent.

## Technical details

- **Route**: `/calendar`, with an optional `month` query parameter in the form `YYYY-MM`. Anything that does not match, or falls outside 1900-2200, shows the current month.
- **Data**: the page is rendered on the server and reads the same data as the rest of the app. There is no separate API endpoint.
- **Deleted items**: dates and people in the trash are not shown.
- **Time zones**: dates are stored as calendar days, so an event never moves to a neighbouring day with your time zone.
