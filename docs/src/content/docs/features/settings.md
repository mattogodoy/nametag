---
title: Settings
description: Configure your Nametag experience.
sidebar:
  order: 16
---

Settings is where you shape Nametag around how you work. Here's what you'll find in each section.

## Profile

Your name, surname, nickname, email address, and profile photo. Photo uploads support cropping, so you can frame it the way you want before saving.

## Appearance

- **Theme**: Light or Dark. Dark is the default.
- **Language**: choose from all of Nametag's supported languages, including English, Spanish, Japanese, Norwegian, German, Chinese, Italian, Russian, Dutch, and French.
- **Date format**: MDY, DMY, or YMD.
- **Name order**: Western (first name, then last name) or Eastern (last name, then first name).
- **Name display format**: Full name, Nickname Preferred, or Short.

### Graph mode

Also configured from Appearance, graph mode controls how your network graph renders: **Individuals** shows each person as their own node, while **Bubbles** groups people together by their group membership. See [Network Graph](/features/network-graph/) for more.

### Install app

Shows how to add Nametag to your home screen or desktop. On Android and desktop this is an install button; on iOS it is step-by-step instructions, because Safari has no install API. If you are already running the installed app, this section just confirms that. See [Installing the App](/features/install/).

## Notifications

Two settings, both about email.

- **Advance notice**: how many days before an important date you want to hear about it, chosen from On the day only, 1 day before, 3, 7, 14, or 30 days before. Advance notice never replaces the day-of reminder. Choosing 7 days before means you get an email 7 days before the event and again on the day itself, always both. The page spells this out directly under the control so you never have to guess.
- **Weekly summary**: an opt-in email summarizing what's coming up in the next 7 days, off by default. Turning it on reveals a day-of-week picker for when it should arrive. If a given week has nothing coming up, no email is sent that week. Silence is the expected behavior for a quiet week, not a sign anything is broken.

The weekly summary's send hour follows the self-hosted instance's own cron schedule, not each user's personal timezone. See [Cron Jobs](/self-hosting/cron-jobs/) for how that's configured.

If the instance has no email delivery configured (no SMTP or Resend, see [Email](/self-hosting/email/)), both controls are shown disabled with an explanation, since there is no point turning on a notification that can never arrive.

## Security

Change your password. You'll need to enter your current password to confirm the change.

## CardDAV

Manage your connection to an external CardDAV server and configure sync behavior. See [CardDAV Sync](/features/carddav/) for the full picture.

## Custom Fields

Define the field templates that appear on every person's profile. See [Custom Fields](/features/custom-fields/) for details.

## Map

A per-user toggle for geocoding, which controls whether Nametag looks up coordinates for addresses to plot them on the map view.

## API Tokens

Create and manage tokens for accessing the Nametag API programmatically. See the API Tokens page for setup details.

## Account

- **Export data**: download your data as JSON or vCard. See [Import & Export](/features/import-export/).
- **Import data**: upload a JSON or vCard file. See [Import & Export](/features/import-export/).
- **Delete account**: permanently removes your account and data. This requires typing "DELETE" to confirm and entering your password, a deliberate double check before something irreversible happens.

## Billing

Available in SaaS mode only, on nametag.one. Shows your current plan, usage meters against your plan's limits, options to upgrade or downgrade, payment history, and a place to enter promo codes. Self-hosted installations don't show this section since all features are unlimited.

## About

App version, license information, and links to the GitHub repository, release notes, and changelog.

## Preference options

| Setting | Options |
| --- | --- |
| Theme | Light, Dark |
| Date format | MDY, DMY, YMD |
| Name order | Western (first, then last), Eastern (last, then first) |
| Name display | Full, Nickname Preferred, Short |
| Graph mode | Individuals, Bubbles |
| Supported languages | English, Spanish, Japanese, Norwegian, German, Chinese, Italian, Russian, Dutch, French (10 total) |
| Advance notice | On the day only, 1, 3, 7, 14, or 30 days before |
| Weekly summary | Off (default) or on, with a day of the week to send it |
