import { SubscriptionTier, BillingFrequency } from '@prisma/client';

/**
 * Tier limits configuration
 * Defines the maximum number of resources allowed per subscription tier
 */
export const TIER_LIMITS: Record<
  SubscriptionTier,
  {
    maxPeople: number;
    maxGroups: number;
    maxReminders: number;
  }
> = {
  FREE: {
    maxPeople: 50,
    maxGroups: 10,
    maxReminders: 5,
  },
  PERSONAL: {
    maxPeople: 1000,
    maxGroups: 500,
    maxReminders: 100,
  },
  PRO: {
    maxPeople: Infinity,
    maxGroups: Infinity,
    maxReminders: Infinity,
  },
};

/**
 * Stripe price configuration
 * Maps tier and frequency to Stripe Price IDs
 */
export const STRIPE_PRICES: Record<
  Exclude<SubscriptionTier, 'FREE'>,
  Record<BillingFrequency, { priceId: string; amount: number }>
> = {
  PERSONAL: {
    MONTHLY: {
      priceId: process.env.STRIPE_PRICE_PERSONAL_MONTHLY || '',
      amount: 100, // $1.00 in cents
    },
    YEARLY: {
      priceId: process.env.STRIPE_PRICE_PERSONAL_YEARLY || '',
      amount: 1000, // $10.00 in cents
    },
  },
  PRO: {
    MONTHLY: {
      priceId: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
      amount: 200, // $2.00 in cents
    },
    YEARLY: {
      priceId: process.env.STRIPE_PRICE_PRO_YEARLY || '',
      amount: 2000, // $20.00 in cents
    },
  },
};

/**
 * Tier display information for UI
 */
export const TIER_INFO: Record<
  SubscriptionTier,
  {
    name: string;
    description: string;
    monthlyPrice: number | null;
    yearlyPrice: number | null;
    features: string[];
  }
> = {
  FREE: {
    name: 'Free',
    description: 'Get started with basic features',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      'Up to 50 people',
      'Up to 10 groups',
      'Up to 5 reminders',
      'Basic relationship tracking',
    ],
  },
  PERSONAL: {
    name: 'Personal',
    description: 'For individuals managing larger networks',
    monthlyPrice: 1,
    yearlyPrice: 10,
    features: [
      'Up to 1,000 people',
      'Up to 500 groups',
      'Up to 100 reminders',
      'Priority support',
    ],
  },
  PRO: {
    name: 'Pro',
    description: 'Unlimited access for power users',
    monthlyPrice: 2,
    yearlyPrice: 20,
    features: [
      'Unlimited people',
      'Unlimited groups',
      'Unlimited reminders',
      'Priority support',
      'Early access to new features',
    ],
  },
};

/**
 * Resource types that can be limited
 */
export type LimitedResource = 'people' | 'groups' | 'reminders';

/**
 * Get the limit for a specific resource and tier
 */
export function getTierLimit(tier: SubscriptionTier, resource: LimitedResource): number {
  const limits = TIER_LIMITS[tier];
  switch (resource) {
    case 'people':
      return limits.maxPeople;
    case 'groups':
      return limits.maxGroups;
    case 'reminders':
      return limits.maxReminders;
  }
}

/**
 * Check if a tier has unlimited access to a resource
 */
export function isUnlimited(tier: SubscriptionTier, resource: LimitedResource): boolean {
  return getTierLimit(tier, resource) === Infinity;
}
