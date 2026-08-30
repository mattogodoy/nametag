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
- **Webhook**: a signed HTTP request sent to a server you control. Off until you add a destination. On nametag.one this is part of Pro; self-hosted instances have no such restriction.

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

A device that fails ten consecutive nightly runs is switched off, the same as any other destination. Your browser has no way to notice this on its own, since its permission and service worker are still valid, so the device is marked in Settings with the reason. Turning push back on from that device re-registers it and clears the state.

1. In the ntfy app, or at [ntfy.sh](https://ntfy.sh) in a browser, pick a topic name and subscribe to it.
2. In Nametag, go to Settings, Notifications, and add a destination with the full topic URL, for example `https://ntfy.sh/my-topic`.

When you save the destination, Nametag checks that an ntfy server actually answers at that address before storing it. A URL that merely looks like a topic URL but points at something else is rejected right away, rather than being accepted and then silently failing every night. Credentials in the URL itself (`https://user:password@ntfy.example.com/topic`) are rejected too: use the access token field instead, which is encrypted at rest.
3. Send a test to confirm it arrives before you rely on it.

On the public ntfy.sh server, the topic name is the only thing standing between your reminders and anyone who guesses it or finds it some other way: anyone who knows the topic name can subscribe to it too. Pick something long and hard to guess, not a word or your own name. If you run your own ntfy server, or the topic needs an access token to publish to, add that token when you create the destination. It's encrypted at rest and is never shown back to you once saved.

Reminder timing (the lead time and the weekly digest) is configurable as long as you have any working channel, not just email. A self-hosted instance with no SMTP but a working ntfy destination can still choose when reminders arrive.

You can add up to five destinations, ntfy or otherwise. A destination that fails delivery on ten consecutive nightly runs is switched off automatically, so a dead topic or a decommissioned server doesn't keep failing quietly forever. This is tracked per run, not per reminder, so a night with a weekly digest and several birthday reminders still only counts as one failure against the threshold if every one of them failed, and a `429` response (the destination telling us to slow down) never counts toward the threshold at all, so a receiver enforcing its own rate limit cannot get itself switched off for it. The destination stays visible in Settings, showing whether it was switched off automatically (with the reason for the last failure) or turned off manually, and you can turn it back on from either state.

## Sending reminders to a webhook

A webhook is your own HTTPS endpoint. Nametag sends it a signed JSON request for each reminder, so you can route reminders into your own system: a home automation hook, a personal API, a chat integration, anything that can receive a POST and verify a signature.

On nametag.one, outgoing webhooks are part of Pro. Self-hosted, every user can add one, with no subscription involved. Access is tied to your subscription tier, not to whether a payment currently succeeds: only a fully cancelled subscription drops you to Free and stops webhook delivery. A payment that fails keeps your Pro access through Stripe's own retry window, known as dunning, so a card that needs updating does not cut off delivery the moment it lapses. Once the subscription is cancelled, existing webhook destinations stop being delivered to, with no separate cleanup step; renewing the subscription resumes delivery, and the destination itself is left in place either way.

1. In Nametag, go to Settings, Notifications, and add a webhook destination with your endpoint's URL.
2. Nametag generates a signing secret and shows it to you once. Save it now: there is no way to view it again, and if you lose it you'll need to remove the webhook and add it back to get a new one.
3. Send a test to confirm delivery and signature verification both work before you rely on it.

### Payload

Each reminder is a single `POST` with a JSON body:

```json
{
  "event": "reminder.important_date",
  "occurredAt": "2026-08-26T09:00:00.000Z",
  "title": "Ana Torres",
  "body": "Birthday today",
  "url": "https://your-instance.example.com/people/clxperson1",
  "data": {
    "personId": "clxperson1",
    "personName": "Ana Torres",
    "dateTitle": "Birthday",
    "dateType": "birthday",
    "formattedDate": "August 26, 1990",
    "date": "2026-08-26"
  }
}
```

- `event` is `reminder.` followed by the kind of reminder: `important_date`, `important_date_lead`, `contact`, or `weekly_digest`.
- `occurredAt` is when Nametag sent the request, an ISO 8601 timestamp, not when the event itself falls.
- `title` and `body` are a short, human-readable summary, **localised to the sending user's own language and locale settings**. They are meant for display, not for parsing or matching: do not branch your integration on their text, since the same event produces different wording per user and can change with translation updates. Use `data` and `event` for anything your code needs to key on.
- `url` is a link back into your Nametag instance. For `important_date`, `important_date_lead`, and `contact`, it's the person's page; for `weekly_digest` it points at the dashboard instead, since a digest is not about one person.
- `data` varies by `event`:
  - `important_date` carries `personId`, `personName`, `dateTitle`, `dateType` (one of `birthday`, `anniversary`, `nameday`, `memorial`, or `null` for a custom date type), `formattedDate` (locale-formatted, for display only), and `date`.
  - `important_date_lead` carries the same fields except `dateType`, replaced with `daysUntil` (a number).
  - `contact` carries `personId`, `personName`, `lastContact` (a locale-formatted string, or `null` if no contact has ever been logged for that person), and `interval`.
  - `weekly_digest` carries `events` (a list, each with `personName`, `eventTitle`, `formattedDate`, `date`, and `daysUntil`) and `overflowCount` (a number, `0` when nothing was left out: the digest caps how many events it lists, and this is how many more there were beyond that cap for the week).
- `date` (on `important_date`, `important_date_lead`, and each `weekly_digest` event) is a raw ISO calendar date (`YYYY-MM-DD`) so a receiver doesn't have to guess a date format from your locale. It is always the day of the **occurrence being reminded about**, today's date for a day-of reminder or the projected date for an advance notice, never the date the record was originally entered. That means a recurring birthday's `date` never carries the year it was born in, only the year the occurrence falls in.
- `formattedDate` is a display string, rendered in the account's date format and language. It is not always derived from the same source as `date`, and the two can legitimately name different years for the same event. On a day-of `important_date`, `formattedDate` is rendered from the stored record itself, so a birthday's `formattedDate` shows the year the person was born, while `date` shows the year the occurrence falls in. On `important_date_lead`, `formattedDate` is rendered from the projected occurrence, so its year matches `date`. Treat `formattedDate` as text for a person to read, never something to parse: if your integration needs to reason about when the occurrence falls, use `date`.

Contact names and other person details leave your Nametag instance in this payload, sent to whatever server you point the webhook at. Only add an endpoint you control.

### Delivery guarantees

Each reminder is sent as one `POST`, once, during the nightly run that decided it was due. There are no retries and no idempotency key: if your endpoint is down or rejects the request, that delivery is gone, not queued for a later attempt. Design your integration for at-most-once delivery, and treat a missed webhook the same way you'd treat a missed push notification, not as something to reconcile against a resend.

### Verifying the signature

Every request carries these headers:

| Header | Value |
| --- | --- |
| `User-Agent` | `Nametag/<version> (+https://nametag.one)` |
| `Content-Type` | `application/json` |
| `Content-Length` | The byte length of the body |
| `X-Nametag-Event` | The same value as the body's `event` field |
| `X-Nametag-Timestamp` | Unix timestamp, in seconds, of when the request was sent |
| `X-Nametag-Signature` | `sha256=<hex-encoded HMAC-SHA256 digest>` |

Nothing from a person's record or from your own settings ever becomes a header, only values inside the signed JSON body. `X-Nametag-Event` is included for convenience so you can inspect it without parsing the body, but it is **not covered by the signature**: route your handling on the body's `event` field, not the header, if the distinction matters for your integration.

The signature is computed over the string `<timestamp>.<raw body>`, that is, the timestamp, a literal period, and the exact bytes of the request body, keyed with the signing secret you saved when you created the destination. Binding the timestamp into the signed message, rather than signing the body alone, is what makes the timestamp useful for replay protection: a captured request cannot be replayed later with a new timestamp, because the signature would no longer match.

The signing secret is a 64-character hex string, but the key for the HMAC is **the UTF-8 bytes of that string itself**, not the 32 bytes you'd get by hex-decoding it. Hex-decoding the secret before using it as the HMAC key is the single most common mistake when implementing a verifier by hand, and it fails silently: every signature check just comes back wrong, with nothing in the request to tell you why.

Verify the signature before trusting a payload:

```js
const crypto = require('node:crypto');

function verify(rawBody, headers, secret) {
  const timestamp = headers['x-nametag-timestamp'];
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

  const a = Buffer.from(headers['x-nametag-signature']);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  // Reject anything older than five minutes so a captured payload cannot be
  // replayed later.
  return Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;
}
```

Use `rawBody` exactly as received, before any JSON parsing: re-serializing the parsed object can reorder keys or change whitespace, and the signature would no longer match a re-encoded body. Compare signatures with `timingSafeEqual` rather than `===`, and reject anything outside a freshness window, five minutes is reasonable, so a captured request cannot be replayed after the fact.

## Privacy

Push notifications are encrypted end to end by the Web Push protocol itself. The push service that relays the message, whichever company runs it, never sees the plain content: not a contact's name, not what the reminder is about. Only your browser can decrypt it.

You can edit a saved destination: change its URL, replace or clear an ntfy access token, or generate a new webhook signing secret. A replacement URL is re-checked exactly as it was when you first added it, including the ntfy server check, so an edit can't get a destination into a state that adding one wouldn't allow. Changing the URL or the credential also clears the failure counter, so a destination you've just repaired isn't still marked with the reason it was switched off. The destination type itself can't be changed.

Being able to replace a credential in place matters most after you rotate `NEXTAUTH_SECRET`: that makes every stored token and signing secret undecryptable, and without a way to replace them the only option would be deleting each destination and adding it again.

On nametag.one, outgoing webhooks need an active Pro subscription. The check runs on every send rather than being recorded on the destination, so delivery stops the moment a subscription ends. Because a skipped send isn't a failure, the destination doesn't accumulate failures or switch itself off, so Settings marks it explicitly as not being delivered to rather than leaving it looking healthy.

A webhook's signing secret is encrypted at rest and never shown back to you after creation. Generating a new one shows it once, in the same way, and your receiver has to be updated with it or it will reject every webhook. The webhook URL itself is not: it's stored and displayed in plaintext, the same as an ntfy topic URL. That asymmetry matters because a webhook URL is often itself a credential, not just an address. Slack, Discord, and Home Assistant, among others, embed a secret token directly in the URL path, so anyone who can see that URL can post to it. Treat it with the same care you'd give a password.

## Technical details

- Removing a device from the list takes effect immediately. The next reminder simply is not sent to it.
- Clearing your browser data, uninstalling the app, or revoking notification permission invalidates the subscription on your device right away. Nametag notices on its next attempt to deliver to that device and removes it from your list automatically, you don't need to do anything on your end.
- Removing a device's row from a different browser or session than the one that owns it does not tell that browser anything. It keeps believing push is on until it next tries to deliver, or until you open its own Notifications page, at which point turning it on again re-registers the same device. This is inherent to how web push works, not something Nametag can push a live update around.
- A reminder that targets the same event twice, such as a corrected send, replaces the earlier push notification on your device rather than stacking a second one next to it.
- Tapping a push notification opens Nametag to the relevant page, reusing an already-open tab if you have one instead of opening a new window.
- On nametag.one, an ntfy or webhook destination must be HTTPS on port 443, and cannot point at a private or internal address. A URL on a non-standard port, such as `https://ntfy.example.com:8443/topic`, is rejected even though it's HTTPS. A self-hosted instance has no such restriction, since reaching a server on your own network, such as a LAN ntfy box on whatever port it listens on, is exactly the point.
- Nametag never follows a redirect from a destination. If your server responds with one, the request is reported as failed rather than followed somewhere else.
- A request to a destination times out after five seconds, on top of a separate five-second budget for resolving its hostname, so the worst case before a delivery is reported as failed is roughly ten seconds. A slow receiver is treated the same as one that never responds.
- The response body of an ntfy or webhook request is never read, only the status code and, for ntfy, the `Content-Type` header. Nothing your server writes back can change what Nametag does with it, and it cannot be used to pull data out of a server Nametag can otherwise reach. The `Content-Type` check exists so that a 2xx from a host that isn't ntfy is recorded as a failure rather than as a delivery: without it, a mistyped address that returns `200` would mark the reminder as sent and it would never be retried.
- When you add an ntfy destination, Nametag asks the server's `/v1/health` endpoint whether it is an ntfy server. That is the one request whose response body is read, it is capped at 1 KB, and the result is reduced to yes or no before it reaches you, so it cannot be used to read anything back out of a server.
- A webhook's headers are a fixed set: `User-Agent`, `Content-Type`, `Content-Length`, `X-Nametag-Event`, `X-Nametag-Timestamp`, and `X-Nametag-Signature`. Nothing from a person's record or from your own settings ever becomes a header, only values inside the signed JSON body.
