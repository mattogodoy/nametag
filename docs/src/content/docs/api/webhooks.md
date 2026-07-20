---
title: Webhooks
description: The Stripe webhook endpoint that keeps subscription and billing data in sync.
sidebar:
  order: 12
---

Nametag's billing is powered by Stripe, and is only active in [SaaS mode](/self-hosting/configuration/) (`SAAS_MODE=true`). Self-hosted instances don't process billing events. This endpoint isn't something you call yourself, Stripe calls it, but it's documented here for completeness and for anyone running their own SaaS-mode fork.

## Stripe webhook

```
POST /api/webhooks/stripe
```

Receives billing lifecycle events from Stripe and updates the local `Subscription` and `PaymentHistory` records accordingly.

### Authentication

Not session or API-token authenticated. Instead, the request body is verified against the `stripe-signature` header using the `STRIPE_WEBHOOK_SECRET` environment variable. Requests with a missing or invalid signature are rejected with `400` before any data is touched.

### Idempotency

Each event's Stripe event ID is recorded in a unique-constrained table. A duplicate delivery (Stripe retries on timeout) is detected and skipped, returning `{ "received": true }` without reprocessing.

### Handled event types

| Event | Effect |
| --- | --- |
| `checkout.session.completed` | Saves the Stripe customer ID on the user's subscription. |
| `customer.subscription.created` | Updates tier, status, billing frequency, and period dates. Sends a "subscription created" email. |
| `customer.subscription.updated` | Same as above. Sends a "plan changed" email if the tier changed. |
| `customer.subscription.deleted` | Downgrades the subscription to the `FREE` tier and cancels it. Sends a cancellation email. |
| `invoice.paid` | Records a `PaymentHistory` entry with status `SUCCEEDED`. |
| `invoice.payment_failed` | Records a `PaymentHistory` entry with status `FAILED` and marks the subscription `PAST_DUE`. |

Any other event type is logged and acknowledged without further action.

### Response

```json
{ "received": true }
```

On a handler error, the endpoint returns `500` with `{ "error": "message" }` so Stripe retries delivery.

### Configuring the endpoint

In your Stripe dashboard, point a webhook to:

```
https://your-instance.example.com/api/webhooks/stripe
```

Subscribe it to at least: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copy the signing secret Stripe gives you into `STRIPE_WEBHOOK_SECRET`.

### Testing locally

Use the Stripe CLI to forward events to a local instance:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a webhook signing secret to use as `STRIPE_WEBHOOK_SECRET` while testing.
