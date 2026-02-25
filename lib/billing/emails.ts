import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';
import { SubscriptionTier, BillingFrequency } from '@prisma/client';
import { TIER_INFO } from './constants';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('billing');

// Tier ranking for determining upgrade vs downgrade
const TIER_RANK: Record<SubscriptionTier, number> = {
  FREE: 0,
  PERSONAL: 1,
  PRO: 2,
};

/**
 * Currency symbols for common currencies
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  jpy: '¥',
  cad: 'C$',
  aud: 'A$',
  chf: 'CHF ',
};

/**
 * Get currency symbol from currency code
 */
function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toLowerCase()] || `${currency.toUpperCase()} `;
}

/**
 * Format price for display with currency
 */
function formatPrice(
  tier: SubscriptionTier,
  frequency: BillingFrequency | null,
  currency: string = 'usd',
  amountInCents?: number
): string {
  const symbol = getCurrencySymbol(currency);

  // If we have the actual amount from Stripe, use it
  if (amountInCents !== undefined) {
    const amount = amountInCents / 100;
    return `${symbol}${amount.toFixed(2)}`;
  }

  // Fallback to tier info prices
  const tierInfo = TIER_INFO[tier];
  if (frequency === 'YEARLY' && tierInfo.yearlyPrice) {
    return `${symbol}${tierInfo.yearlyPrice}`;
  }
  if (tierInfo.monthlyPrice) {
    return `${symbol}${tierInfo.monthlyPrice}`;
  }
  return 'Free';
}

/**
 * Format frequency for display
 */
function formatFrequency(frequency: BillingFrequency | null): string {
  if (frequency === 'YEARLY') return 'billed yearly';
  if (frequency === 'MONTHLY') return 'billed monthly';
  return '';
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get user email by userId
 */
async function getUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

/**
 * Determine if a tier change is an upgrade
 */
function isUpgrade(oldTier: SubscriptionTier, newTier: SubscriptionTier): boolean {
  return TIER_RANK[newTier] > TIER_RANK[oldTier];
}

/**
 * Send email when a user subscribes to a paid plan
 */
export async function sendSubscriptionCreatedEmail(
  userId: string,
  tier: SubscriptionTier,
  frequency: BillingFrequency | null,
  currency: string = 'usd',
  amountInCents?: number
): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) {
    log.warn({ userId }, 'Cannot send subscription created email: user email not found');
    return;
  }

  const tierInfo = TIER_INFO[tier];
  const price = formatPrice(tier, frequency, currency, amountInCents);
  const frequencyText = formatFrequency(frequency);

  const template = await emailTemplates.subscriptionCreated(
    tierInfo.name,
    price,
    frequencyText
  );

  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    from: 'accounts',
  });

  if (result.success) {
    log.info({ userId, tier }, 'Subscription created email sent');
  } else {
    log.error({ userId, errorMessage: result.error }, 'Failed to send subscription created email');
  }
}

/**
 * Send email when a user changes their subscription tier (upgrade or downgrade)
 */
export async function sendSubscriptionChangedEmail(
  userId: string,
  oldTier: SubscriptionTier,
  newTier: SubscriptionTier,
  frequency: BillingFrequency | null,
  currency: string = 'usd',
  amountInCents?: number
): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) {
    log.warn({ userId }, 'Cannot send subscription changed email: user email not found');
    return;
  }

  const oldTierInfo = TIER_INFO[oldTier];
  const newTierInfo = TIER_INFO[newTier];
  const price = formatPrice(newTier, frequency, currency, amountInCents);
  const frequencyText = formatFrequency(frequency);
  const tierIsUpgrade = isUpgrade(oldTier, newTier);

  const template = await emailTemplates.subscriptionChanged(
    oldTierInfo.name,
    newTierInfo.name,
    price,
    frequencyText,
    tierIsUpgrade
  );

  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    from: 'accounts',
  });

  if (result.success) {
    log.info({ userId, oldTier, newTier, isUpgrade: tierIsUpgrade }, 'Subscription changed email sent');
  } else {
    log.error({ userId, errorMessage: result.error }, 'Failed to send subscription changed email');
  }
}

/**
 * Send email when a user cancels their subscription
 */
export async function sendSubscriptionCanceledEmail(
  userId: string,
  tier: SubscriptionTier,
  accessUntil: Date | null,
  immediately: boolean
): Promise<void> {
  const email = await getUserEmail(userId);
  if (!email) {
    log.warn({ userId }, 'Cannot send subscription canceled email: user email not found');
    return;
  }

  const tierInfo = TIER_INFO[tier];
  const accessUntilFormatted = accessUntil ? formatDate(accessUntil) : null;

  const template = await emailTemplates.subscriptionCanceled(
    tierInfo.name,
    accessUntilFormatted,
    immediately
  );

  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
    from: 'accounts',
  });

  if (result.success) {
    log.info({ userId, tier, immediately }, 'Subscription canceled email sent');
  } else {
    log.error({ userId, errorMessage: result.error }, 'Failed to send subscription canceled email');
  }
}
