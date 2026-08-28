---
title: Important Dates
description: Track birthdays, anniversaries, and custom dates with optional reminders.
sidebar:
  order: 7
---

Important dates keep the moments that matter attached to the people they belong to: birthdays, anniversaries, name days, memorials, or anything else you want to remember on a recurring or one-time basis.

## Adding a date

On a person's edit page, add as many important dates as you like. Each one needs:

- **Title**: pick from the predefined options (Birthday, Anniversary, Name Day, Memorial) or choose "Other" to type your own custom title, like "First met" or "Started at the company"
- **Date**: a full date, or just a month and day if you don't know the year. Nametag handles year-unknown dates gracefully everywhere they're displayed

## Reminders for a date

Any important date can have a reminder attached, turned on with a toggle right below the date itself. Once enabled, you choose how it should fire:

- **Once**: sends a single reminder on the date itself. Only available for dates in the future
- **Recurring**: sends a reminder every time the interval elapses, for example every year on the anniversary, or every 6 months. You set both the number and the unit: days, weeks, months, or years

Recurring reminders default to once a year, which fits birthdays and anniversaries, but you can change the interval to anything that makes sense for the date.

## Advance notice for a single date

Once a reminder is on for a date, a second control lets you choose how far ahead of it you want to be notified for that date specifically:

- **Default**: follows the advance notice setting on the [Notifications settings page](/features/settings/#notifications). The option shows the resolved value, for example "Default (7 days before)", so you can see what inheriting currently means without leaving the person's form. If you later change the setting on the Notifications page, every date left on "Default" picks up the new value automatically
- **On the day only**: sends the reminder only on the date itself for this date, even if your account default is a positive number of days. This is a deliberate override, distinct from "Default", not a shortcut for a zero-day default
- **1, 3, 7, 14, or 30 days before**: overrides the account default with a specific lead time for this date only

Whatever you choose, the day-of reminder always fires. Advance notice adds an earlier heads-up; it never replaces the reminder on the day itself.

If a recurring date comes round more often than the lead time you asked for, for example a 7 day advance notice on something that repeats every 3 days, the notice is shortened to the length of the interval. Each occurrence still gets exactly one heads-up, just a proportionally earlier one, rather than some occurrences being announced and others silently skipped.

## The dashboard upcoming events widget

Your dashboard shows a list of upcoming birthdays, anniversaries, and other important dates across your whole network, sorted by how soon they're coming up. It's a quick way to see what's approaching without opening each person individually.

## Notifications

If you'd like to actually be notified when a reminder is due, rather than only seeing it on the dashboard, turn on a delivery channel in Settings under Notifications: email (needs Resend or SMTP configured on your instance) or browser push (needs VAPID keys configured). See [Notifications](/features/notifications/) for how to set either one up. Without any channel configured, reminders still work: they show up on the dashboard, they're just not delivered anywhere else.

Reminders are sent daily by a background job. See [Contact Reminders](/features/contact-reminders/) for details on how that job runs, since important date reminders and contact reminders share the same delivery mechanism.

## Tier limits

In SaaS mode, the total number of active reminders (combining important date reminders and contact reminders) depends on your plan:

- **Free**: up to 5 reminders
- **Personal**: up to 100 reminders
- **Pro**: unlimited reminders

Self-hosted installations are not subject to these limits. Turning off a reminder frees up a slot even if the important date itself stays on the person's record.

## Technical details

- **Predefined date types**: Birthday, Anniversary, Name Day, Memorial, plus a custom "Other" type with a free-text title
- **Date title**: up to 100 characters
- **Reminder interval range**: 1-99
- **Reminder interval units**: Days, Weeks, Months, Years
- **Reminder types**: Once (fires a single time), Recurring (fires every interval, for example every year)
- **Advance notice per date**: Default (inherits the account setting), On the day only, or 1, 3, 7, 14, 30 days before; stored as 0-365 days, with `null` meaning "inherit the account default"
- **Date storage**: calendar dates are stored as UTC midnight on the day you picked, so the day never shifts with your timezone
- **Unknown years**: dates saved without a year are stored under year 1604, Apple's marker for an unknown year, which keeps them compatible with Contacts and other CardDAV clients
- **February 29**: in non-leap years, a February 29 date appears (and its yearly reminder fires) on March 1. Advance notice follows the same day, so both emails agree
