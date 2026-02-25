import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { constructWebhookEvent } from '@/lib/billing/stripe';
import {
  sendSubscriptionCreatedEmail,
  sendSubscriptionChangedEmail,
  sendSubscriptionCanceledEmail,
} from '@/lib/billing/emails';
import { SubscriptionTier, BillingFrequency, SubscriptionStatus, PaymentStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';

// Disable body parsing, we need raw body for webhook signature verification
export const dynamic = 'force-dynamic';

// Helper to get tier from Stripe metadata or price
function getTierFromMetadata(metadata: Stripe.Metadata): SubscriptionTier {
  const tier = metadata.tier?.toUpperCase();
  if (tier === 'PERSONAL' || tier === 'PRO') {
    return tier as SubscriptionTier;
  }
  return 'FREE';
}

// Helper to get frequency from Stripe metadata
function getFrequencyFromMetadata(metadata: Stripe.Metadata): BillingFrequency | null {
  const frequency = metadata.frequency?.toUpperCase();
  if (frequency === 'MONTHLY' || frequency === 'YEARLY') {
    return frequency as BillingFrequency;
  }
  return null;
}

// POST /api/webhooks/stripe - Handle Stripe webhook events
export const POST = withLogging(async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const body = await request.text();
    event = constructWebhookEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err: err instanceof Error ? err : new Error(String(err)) }, 'Webhook signature verification failed');
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), eventType: event.type }, 'Webhook handler error');
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.error({ sessionId: session.id }, 'No userId in checkout session metadata');
    return;
  }

  const tier = getTierFromMetadata(session.metadata || {});
  const frequency = getFrequencyFromMetadata(session.metadata || {});

  logger.info({ userId, tier, frequency, sessionId: session.id }, 'Checkout completed');

  // The subscription update will be handled by customer.subscription.created/updated
  // But we ensure the customer ID is saved
  if (session.customer) {
    await prisma.subscription.update({
      where: { userId },
      data: {
        stripeCustomerId: session.customer as string,
      },
    });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find by customer ID
    const customerId = subscription.customer as string;
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!existingSubscription) {
      logger.error({
        stripeSubscriptionId: subscription.id,
        customerId,
      }, 'No subscription found for Stripe subscription');
      return;
    }

    await updateLocalSubscription(existingSubscription.userId, subscription);
  } else {
    await updateLocalSubscription(userId, subscription);
  }
}

async function updateLocalSubscription(userId: string, stripeSubscription: Stripe.Subscription) {
  const newTier = getTierFromMetadata(stripeSubscription.metadata);
  const frequency = getFrequencyFromMetadata(stripeSubscription.metadata);

  // Get current subscription to compare tiers
  const currentSubscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { tier: true },
  });
  const oldTier = currentSubscription?.tier ?? SubscriptionTier.FREE;

  // Map Stripe status to our status
  let status: SubscriptionStatus;
  switch (stripeSubscription.status) {
    case 'active':
    case 'trialing':
      status = SubscriptionStatus.ACTIVE;
      break;
    case 'past_due':
      status = SubscriptionStatus.PAST_DUE;
      break;
    case 'unpaid':
      status = SubscriptionStatus.UNPAID;
      break;
    case 'canceled':
      status = SubscriptionStatus.CANCELED;
      break;
    case 'paused':
      status = SubscriptionStatus.PAUSED;
      break;
    default:
      status = SubscriptionStatus.ACTIVE;
  }

  const subscriptionItem = stripeSubscription.items.data[0];
  const priceId = subscriptionItem?.price?.id;

  // Extract currency and amount from the subscription
  const currency = (stripeSubscription as unknown as Record<string, unknown>).currency as string || 'usd';
  const priceData = subscriptionItem?.price as unknown as Record<string, unknown>;
  const amountInCents = priceData?.unit_amount as number | undefined;

  // Handle both old and new Stripe API property names
  const subscriptionData = stripeSubscription as unknown as Record<string, unknown>;
  const currentPeriodStart = subscriptionData.current_period_start as number | undefined;
  const currentPeriodEnd = subscriptionData.current_period_end as number | undefined;
  const cancelAtPeriodEnd = subscriptionData.cancel_at_period_end as boolean | undefined;

  await prisma.subscription.update({
    where: { userId },
    data: {
      tier: newTier !== 'FREE' ? newTier : undefined, // Don't downgrade to FREE here
      status,
      billingFrequency: frequency,
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : undefined,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined,
      cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
      tierStartedAt: newTier !== 'FREE' ? new Date() : undefined,
    },
  });

  logger.info({ userId, tier: newTier, status, stripeSubscriptionId: stripeSubscription.id }, 'Subscription updated');

  // Send email notifications for tier changes (only for active subscriptions)
  if (status === SubscriptionStatus.ACTIVE && newTier !== 'FREE') {
    if (oldTier === 'FREE') {
      // New subscription (FREE -> paid tier)
      await sendSubscriptionCreatedEmail(userId, newTier, frequency, currency, amountInCents);
    } else if (oldTier !== newTier) {
      // Tier change (upgrade or downgrade)
      await sendSubscriptionChangedEmail(userId, oldTier, newTier, frequency, currency, amountInCents);
    }
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!existingSubscription) {
    logger.warn({
      stripeSubscriptionId: subscription.id,
    }, 'No subscription found for deleted Stripe subscription');
    return;
  }

  const previousTier = existingSubscription.tier;

  // Downgrade to free tier
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.CANCELED,
      billingFrequency: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });

  logger.info({ userId: existingSubscription.userId }, 'Subscription deleted, downgraded to free');

  // Send cancellation email (immediate cancellation since subscription was deleted)
  if (previousTier !== 'FREE') {
    await sendSubscriptionCanceledEmail(
      existingSubscription.userId,
      previousTier,
      null,
      true // immediately
    );
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Handle Stripe API type differences
  const invoiceData = invoice as unknown as Record<string, unknown>;
  const customerId = invoiceData.customer as string;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!existingSubscription) {
    logger.warn({ invoiceId: invoice.id }, 'No subscription found for invoice');
    return;
  }

  // Extract invoice fields with type safety
  const amountPaid = (invoiceData.amount_paid as number) || 0;
  const currency = (invoiceData.currency as string) || 'usd';
  const subtotal = (invoiceData.subtotal as number) || 0;
  const paymentIntent = invoiceData.payment_intent as string | null;
  const description = invoiceData.description as string | null;
  const statusTransitions = invoiceData.status_transitions as { paid_at?: number } | undefined;
  const totalDiscountAmounts = invoiceData.total_discount_amounts as Array<{ amount: number }> | undefined;

  // Record payment history
  await prisma.paymentHistory.create({
    data: {
      subscriptionId: existingSubscription.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: paymentIntent,
      amount: amountPaid,
      currency: currency,
      status: PaymentStatus.SUCCEEDED,
      description: description || `Subscription payment`,
      originalAmount: subtotal,
      discountAmount: totalDiscountAmounts?.reduce((sum, d) => sum + d.amount, 0) || 0,
      paidAt: statusTransitions?.paid_at
        ? new Date(statusTransitions.paid_at * 1000)
        : new Date(),
    },
  });

  logger.info({
    userId: existingSubscription.userId,
    invoiceId: invoice.id,
    amount: amountPaid,
  }, 'Invoice paid recorded');
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // Handle Stripe API type differences
  const invoiceData = invoice as unknown as Record<string, unknown>;
  const customerId = invoiceData.customer as string;

  const existingSubscription = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!existingSubscription) {
    logger.warn({ invoiceId: invoice.id }, 'No subscription found for failed invoice');
    return;
  }

  // Extract invoice fields with type safety
  const amountDue = (invoiceData.amount_due as number) || 0;
  const currency = (invoiceData.currency as string) || 'usd';
  const paymentIntent = invoiceData.payment_intent as string | null;

  // Record failed payment
  await prisma.paymentHistory.create({
    data: {
      subscriptionId: existingSubscription.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: paymentIntent,
      amount: amountDue,
      currency: currency,
      status: PaymentStatus.FAILED,
      description: `Failed payment attempt`,
    },
  });

  // Update subscription status to past_due
  await prisma.subscription.update({
    where: { id: existingSubscription.id },
    data: {
      status: SubscriptionStatus.PAST_DUE,
    },
  });

  logger.warn({
    userId: existingSubscription.userId,
    invoiceId: invoice.id,
  }, 'Invoice payment failed');
}
