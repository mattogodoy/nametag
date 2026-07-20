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

## The dashboard upcoming events widget

Your dashboard shows a list of upcoming birthdays, anniversaries, and other important dates across your whole network, sorted by how soon they're coming up. It's a quick way to see what's approaching without opening each person individually.

## Email notifications

If you'd like an actual email when a reminder is due, Nametag needs an email provider configured, either Resend or SMTP. Without one configured, reminders still work: they show up on the dashboard, they're just not delivered to your inbox.

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
