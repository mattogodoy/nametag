---
title: Notifications
description: Choose how reminders reach you, by email, browser push, or both.
sidebar:
  order: 19
---

Nametag can remind you about important dates and contact reminders in more than one place. Turn on the channels you actually want to be reached on, and a reminder goes out on every one of them, not just the first that matches.

## Channels

- **Email**: sent through whichever provider your instance has configured. On by default.
- **Push**: a browser or device notification, delivered even when Nametag is not open in a tab. Off until you turn it on, and only available if your instance has push configured.
- **ntfy**: a reminder pushed to a topic on [ntfy.sh](https://ntfy.sh) or your own ntfy server. Off until you add a destination.

Email and push live in Settings under Notifications. If your instance has no email provider set up, or push is not configured, the corresponding control is shown disabled with an explanation rather than hidden, so you know why rather than wondering if something is broken.

## Turning on push

Push is enabled per device, not per account. Each phone, tablet, or browser you want reminders on needs its own opt-in:

1. Open Settings and go to Notifications.
2. Turn on the push toggle. Your browser will ask for notification permission.
3. Accept the prompt.

That device now appears in your device list, with a name pulled from its browser and operating system so you can tell your devices apart. Remove any device from that list at any time to stop reminders on it, without touching your other devices or your email setting.

### iOS needs the app installed first

Safari does not support web push on its own. On an iPhone or iPad, install Nametag to your home screen before turning on push, see [Installing the App](/features/install/). Until it's installed, the Notifications page shows a hint explaining this instead of a push toggle that would not work.

You'll also need iOS or iPadOS 16.4 or later. Apple only added web push support in that release, so on an older version even an installed copy of Nametag has nowhere to receive it. If push still is not available after installing, that's the first thing to check.

## Sending reminders to ntfy

[ntfy](https://ntfy.sh) is a simple pub-sub notification service. You pick a topic name, subscribe to it in the ntfy app or a browser tab, and anything published to that topic shows up as a notification. Nametag can publish your reminders there.

1. In the ntfy app, or at [ntfy.sh](https://ntfy.sh) in a browser, pick a topic name and subscribe to it.
2. In Nametag, go to Settings, Notifications, and add a destination with the full topic URL, for example `https://ntfy.sh/my-topic`.
3. Send a test to confirm it arrives before you rely on it.

On the public ntfy.sh server, the topic name is the only thing standing between your reminders and anyone who guesses it or finds it some other way: anyone who knows the topic name can subscribe to it too. Pick something long and hard to guess, not a word or your own name. If you run your own ntfy server, or the topic needs an access token to publish to, add that token when you create the destination. It's encrypted at rest and is never shown back to you once saved.

You can add up to five destinations, ntfy or otherwise. A destination that fails delivery on ten consecutive nightly runs is switched off automatically, so a dead topic or a decommissioned server doesn't keep failing quietly forever: this is tracked per run, not per reminder, so a night with a weekly digest and several birthday reminders still only counts as one failure against the threshold if every one of them failed. It stays visible in Settings, showing whether it was switched off automatically (with the reason for the last failure) or turned off manually, and you can turn it back on from either state.

## Privacy

Push notifications are encrypted end to end by the Web Push protocol itself. The push service that relays the message, whichever company runs it, never sees the plain content: not a contact's name, not what the reminder is about. Only your browser can decrypt it.

## Technical details

- Removing a device from the list takes effect immediately. The next reminder simply is not sent to it.
- Clearing your browser data, uninstalling the app, or revoking notification permission invalidates the subscription on your device right away. Nametag notices on its next attempt to deliver to that device and removes it from your list automatically, you don't need to do anything on your end.
- Removing a device's row from a different browser or session than the one that owns it does not tell that browser anything. It keeps believing push is on until it next tries to deliver, or until you open its own Notifications page, at which point turning it on again re-registers the same device. This is inherent to how web push works, not something Nametag can push a live update around.
- A reminder that targets the same event twice, such as a corrected send, replaces the earlier push notification on your device rather than stacking a second one next to it.
- Tapping a push notification opens Nametag to the relevant page, reusing an already-open tab if you have one instead of opening a new window.
- On nametag.one, an ntfy or webhook destination must be HTTPS on port 443, and cannot point at a private or internal address. A URL on a non-standard port, such as `https://ntfy.example.com:8443/topic`, is rejected even though it's HTTPS. A self-hosted instance has no such restriction, since reaching a server on your own network, such as a LAN ntfy box on whatever port it listens on, is exactly the point.
- Nametag never follows a redirect from a destination. If your server responds with one, the request is reported as failed rather than followed somewhere else.
- A request to a destination times out after five seconds, on top of a separate five-second budget for resolving its hostname, so the worst case before a delivery is reported as failed is roughly ten seconds. A slow receiver is treated the same as one that never responds.
