---
title: Contact Reminders
description: Set up recurring reminders to stay in touch with people.
sidebar:
  order: 8
---

Contact reminders are a nudge to stay in touch, separate from birthdays or anniversaries. They're based on how long it's been since you last spoke to someone, not on a fixed date.

## Enabling a reminder

On a person's edit page, toggle "Contact reminder" on. Once enabled, set the interval you want, for example every 2 weeks or every 3 months, using a number and a unit (days, weeks, months, or years).

## Last contact tracking

A person's detail page shows the last time you were in touch, along with a relative description like "3 weeks ago". A quick-update button lets you set "last contacted" to today with a single click, without opening the edit form. Journal entries can also update this date automatically when you tag someone in an entry; see [Journal](/features/journal/) for that flow.

## How reminders fire

A daily background job checks every person who has a contact reminder enabled and compares their last contact date against the interval you configured. If enough time has passed, an email is queued. The job runs once a day, early in the morning, so you'll typically see a reminder the same day it becomes due rather than the exact minute it does.

## Email notifications

Reminder emails are sent through whichever email provider you've configured, Resend or SMTP. Every reminder email includes an unsubscribe link specific to that person. Clicking it turns off the contact reminder for that person only, it doesn't affect reminders for anyone else in your network.

Without an email provider configured, contact reminders are still tracked internally: the dashboard continues to show people you're overdue to contact, you just won't get an email about it.

## Tier limits

In SaaS mode, contact reminders share the same reminder limit as important date reminders:

- **Free**: up to 5 reminders total
- **Personal**: up to 100 reminders total
- **Pro**: unlimited reminders

Self-hosted installations are not subject to these limits.
