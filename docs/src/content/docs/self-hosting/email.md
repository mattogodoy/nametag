---
title: Email
description: Configure Resend or SMTP for password resets and reminder emails.
sidebar:
  order: 3
---

Email is entirely optional for self-hosted instances. Nametag works fully without it:

- **Without email**: new accounts are automatically verified and users can log in immediately. Password resets and contact/date reminders are unavailable, since there's no way to deliver them.
- **With email**: password reset links work, and Nametag can send contact reminders and important date reminders (see [Contact Reminders](/features/contact-reminders/) and [Important Dates](/features/important-dates/)).

If you don't need reminder emails or password resets, you can skip this page entirely.

Nametag supports two ways to send email: Resend, or your own SMTP server. If both are configured, **SMTP takes precedence**.

## Option 1: Resend (recommended for simplicity)

[Resend](https://resend.com) is a transactional email API with a free tier that's enough for personal use.

1. Sign up for a free account at [resend.com](https://resend.com)
2. Add and verify your domain in the Resend dashboard
3. Create an API key
4. Add to your `.env`:

```bash
RESEND_API_KEY=re_your_api_key
EMAIL_DOMAIN=yourdomain.com
```

That's it. Nametag sends from addresses like `accounts@yourdomain.com` and `reminders@yourdomain.com` under your verified domain.

## Option 2: SMTP (use your own email server)

Use any SMTP server: Gmail, Outlook, your own mail server, or a transactional provider like SendGrid or Mailgun.

1. Get your SMTP credentials from your email provider
2. Add to your `.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
EMAIL_DOMAIN=gmail.com
```

### Common SMTP providers

| Provider | Host:Port | Notes |
| --- | --- | --- |
| Gmail | `smtp.gmail.com:587` | Requires an [app password](https://support.google.com/accounts/answer/185833), not your regular password. Only available if 2FA is enabled on the account. |
| Outlook | `smtp-mail.outlook.com:587` | Regular password works unless 2FA is enabled, in which case use an app password. |
| SendGrid | `smtp.sendgrid.net:587` | Username is literally `apikey`; password is your SendGrid API key. |
| Mailgun | `smtp.mailgun.org:587` | Use the SMTP credentials from your Mailgun domain settings, not your account login. |

### Setting up a Gmail app password

1. Enable 2-step verification on your Google account, if it isn't already
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Generate a new app password for "Mail"
4. Use that 16-character password as `SMTP_PASS`, not your normal Gmail password

## From-address behavior

Most SMTP servers restrict which addresses you're allowed to send from, so how you configure `EMAIL_DOMAIN` and `SMTP_FROM` depends on your setup:

**If your SMTP server rejects custom addresses** (an error like "Sender address rejected: not owned by user"), set `SMTP_FROM` to an address you actually own:

```bash
SMTP_FROM=you@example.com
```

All emails then use that address instead of `accounts@`, `reminders@`, and so on.

**For Gmail or Outlook without a custom domain**, these providers automatically rewrite the from-address to your authenticated account. Set `EMAIL_DOMAIN=gmail.com` or `EMAIL_DOMAIN=outlook.com`. Display names are preserved, but the actual address becomes your login email.

**For a properly configured custom domain** (Google Workspace, a business mail server, and so on), you can use addresses like `accounts@yourdomain.com` directly. Set `EMAIL_DOMAIN=yourdomain.com` and leave `SMTP_FROM` unset.

## Rate limiting

SMTP sending uses connection pooling (up to 5 concurrent connections) and is rate limited to 5 messages per second. If you exceed that, Nametag automatically queues the excess and sends it with a short delay rather than dropping it or erroring out.

That queue lives in memory only. If the application restarts while messages are queued, those queued messages are lost. This matters most for someone triggering a large batch (for example, a wave of reminder emails) right before a redeploy.

## A note on the hosted service

[nametag.one](https://nametag.one) requires email verification for new accounts, since it's a public service. Self-hosted instances are built for personal use and skip that step: accounts are auto-verified whether or not email is configured at all.
