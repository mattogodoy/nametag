import { prisma } from '@/lib/prisma';
import {
  SubscriptionTier,
  BillingFrequency,
  SubscriptionStatus,
  Subscription,
  Promotion,
  UserPromotion,
} from '@prisma/client';
import { TIER_LIMITS, LimitedResource, getTierLimit, isUnlimited } from './constants';
import { isSaasMode } from '@/lib/features';

/**
 * Subscription with promotion details
 */
export type SubscriptionWithPromotion = Subscription & {
  promotion:
    | (UserPromotion & {
        promotion: Promotion;
      })
    | null;
};

/**
 * Usage check result
 */
export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  tier: SubscriptionTier;
  isUnlimited: boolean;
}

/**
 * User usage counts
 */
export interface UserUsage {
  people: number;
  groups: number;
  reminders: number;
  customFieldTemplates: number;
}

/**
 * Get a user's subscription with promotion details
 */
export async function getUserSubscription(
  userId: string
): Promise<SubscriptionWithPromotion | null> {
  return prisma.subscription.findUnique({
    where: { userId },
    include: {
      promotion: {
        include: {
          promotion: true,
        },
      },
    },
  });
}

/**
 * Get a user's current usage counts
 */
export async function getUserUsage(userId: string): Promise<UserUsage> {
  const [peopleCount, groupsCount, importantDateReminders, contactReminders, customFieldTemplatesCount] =
    await Promise.all([
      // Count people
      prisma.person.count({
        where: { userId, deletedAt: null },
      }),
      // Count groups
      prisma.group.count({
        where: { userId, deletedAt: null },
      }),
      // Count ImportantDate reminders (where reminderEnabled is true)
      prisma.importantDate.count({
        where: {
          person: { userId, deletedAt: null },
          reminderEnabled: true,
          deletedAt: null,
        },
      }),
      // Count contact reminders (people with contactReminderEnabled)
      prisma.person.count({
        where: {
          userId,
          contactReminderEnabled: true,
          deletedAt: null,
        },
      }),
      // Count custom field templates
      prisma.customFieldTemplate.count({
        where: { userId, deletedAt: null },
      }),
    ]);

  return {
    people: peopleCount,
    groups: groupsCount,
    reminders: importantDateReminders + contactReminders,
    customFieldTemplates: customFieldTemplatesCount,
  };
}

/**
 * Check if a user can create more of a specific resource
 */
export async function canCreateResource(
  userId: string,
  resource: LimitedResource
): Promise<UsageCheckResult> {
  // In self-hosted mode (non-SaaS), always allow unlimited resources
  if (!isSaasMode()) {
    const usage = await getUserUsage(userId);
    return {
      allowed: true,
      current: usage[resource],
      limit: Infinity,
      tier: SubscriptionTier.PRO,
      isUnlimited: true,
    };
  }

  // Get subscription and usage in parallel
  const [subscription, usage] = await Promise.all([
    getUserSubscription(userId),
    getUserUsage(userId),
  ]);

  // Default to FREE tier if no subscription exists
  const tier = subscription?.tier ?? SubscriptionTier.FREE;
  const limit = getTierLimit(tier, resource);
  const current = usage[resource];
  const unlimited = isUnlimited(tier, resource);

  return {
    allowed: unlimited || current < limit,
    current,
    limit,
    tier,
    isUnlimited: unlimited,
  };
}

/**
 * Check if a user can enable a reminder (for use when toggling reminder on ImportantDate or Person)
 */
export async function canEnableReminder(userId: string): Promise<UsageCheckResult> {
  return canCreateResource(userId, 'reminders');
}

/**
 * Create a free subscription for a new user
 */
export async function createFreeSubscription(userId: string): Promise<Subscription> {
  return prisma.subscription.create({
    data: {
      userId,
      tier: SubscriptionTier.FREE,
      status: SubscriptionStatus.ACTIVE,
      tierStartedAt: new Date(),
    },
  });
}

/**
 * Calculate the expiration date for a user's promotion
 * Returns null if the promotion never expires
 */
export function calculatePromotionExpiry(
  promotion: Promotion,
  activatedAt: Date
): Date | null {
  if (promotion.durationType === 'FOREVER') {
    return null; // Never expires
  }

  if (promotion.durationType === 'FIXED') {
    return promotion.fixedEndDate;
  }

  if (promotion.durationType === 'RELATIVE' && promotion.relativeDays) {
    const expiry = new Date(activatedAt);
    expiry.setDate(expiry.getDate() + promotion.relativeDays);
    return expiry;
  }

  return null; // Never expires
}

/**
 * Check if a user's promotion is currently active
 */
export function isPromotionActive(
  userPromotion: UserPromotion & { promotion: Promotion }
): boolean {
  const { promotion, activatedAt } = userPromotion;

  // Check if promotion itself is active
  if (!promotion.isActive) {
    return false;
  }

  // FOREVER promotions are always active (as long as isActive is true)
  if (promotion.durationType === 'FOREVER') {
    return true;
  }

  const now = new Date();

  // For FIXED promotions, check date range
  if (promotion.durationType === 'FIXED') {
    if (promotion.fixedStartDate && now < promotion.fixedStartDate) {
      return false;
    }
    if (promotion.fixedEndDate && now > promotion.fixedEndDate) {
      return false;
    }
    return true;
  }

  // For RELATIVE promotions, check if within duration
  if (promotion.durationType === 'RELATIVE' && promotion.relativeDays) {
    const expiry = calculatePromotionExpiry(promotion, activatedAt);
    if (expiry && now > expiry) {
      return false;
    }
    return true;
  }

  return true;
}

/**
 * Get subscription with computed promotion status
 */
export async function getSubscriptionWithStatus(userId: string): Promise<{
  subscription: SubscriptionWithPromotion | null;
  promotionActive: boolean;
  promotionExpiry: Date | null;
  usage: UserUsage;
  limits: {
    people: { current: number; limit: number; isUnlimited: boolean };
    groups: { current: number; limit: number; isUnlimited: boolean };
    reminders: { current: number; limit: number; isUnlimited: boolean };
    customFieldTemplates: { current: number; limit: number; isUnlimited: boolean };
  };
}> {
  const [subscription, usage] = await Promise.all([
    getUserSubscription(userId),
    getUserUsage(userId),
  ]);

  const tier = subscription?.tier ?? SubscriptionTier.FREE;

  let promotionActive = false;
  let promotionExpiry: Date | null = null;

  if (subscription?.promotion) {
    promotionActive = isPromotionActive(subscription.promotion);
    promotionExpiry = calculatePromotionExpiry(
      subscription.promotion.promotion,
      subscription.promotion.activatedAt
    );
  }

  return {
    subscription,
    promotionActive,
    promotionExpiry,
    usage,
    limits: {
      people: {
        current: usage.people,
        limit: TIER_LIMITS[tier].maxPeople,
        isUnlimited: isUnlimited(tier, 'people'),
      },
      groups: {
        current: usage.groups,
        limit: TIER_LIMITS[tier].maxGroups,
        isUnlimited: isUnlimited(tier, 'groups'),
      },
      reminders: {
        current: usage.reminders,
        limit: TIER_LIMITS[tier].maxReminders,
        isUnlimited: isUnlimited(tier, 'reminders'),
      },
      customFieldTemplates: {
        current: usage.customFieldTemplates,
        limit: TIER_LIMITS[tier].maxCustomFieldTemplates,
        isUnlimited: isUnlimited(tier, 'customFieldTemplates'),
      },
    },
  };
}

/**
 * Apply a promotion code to a subscription
 */
export async function applyPromotion(
  subscriptionId: string,
  promotionCode: string
): Promise<{ success: boolean; error?: string }> {
  // Find the promotion
  const promotion = await prisma.promotion.findUnique({
    where: { code: promotionCode.toUpperCase() },
  });

  if (!promotion) {
    return { success: false, error: 'Invalid promotion code' };
  }

  if (!promotion.isActive) {
    return { success: false, error: 'This promotion is no longer active' };
  }

  // Check if promotion has reached max redemptions
  if (
    promotion.maxRedemptions !== null &&
    promotion.currentRedemptions >= promotion.maxRedemptions
  ) {
    return { success: false, error: 'This promotion has reached its redemption limit' };
  }

  // For FIXED promotions, check if within date range
  if (promotion.durationType === 'FIXED') {
    const now = new Date();
    if (promotion.fixedStartDate && now < promotion.fixedStartDate) {
      return { success: false, error: 'This promotion is not yet active' };
    }
    if (promotion.fixedEndDate && now > promotion.fixedEndDate) {
      return { success: false, error: 'This promotion has expired' };
    }
  }

  // Check if subscription already has a promotion
  const existingPromotion = await prisma.userPromotion.findUnique({
    where: { subscriptionId },
  });

  if (existingPromotion) {
    return { success: false, error: 'You already have an active promotion' };
  }

  // Apply the promotion
  await prisma.$transaction([
    prisma.userPromotion.create({
      data: {
        subscriptionId,
        promotionId: promotion.id,
      },
    }),
    prisma.promotion.update({
      where: { id: promotion.id },
      data: {
        currentRedemptions: { increment: 1 },
      },
    }),
  ]);

  return { success: true };
}

/**
 * Remove a promotion from a subscription
 */
export async function removePromotion(subscriptionId: string): Promise<void> {
  const userPromotion = await prisma.userPromotion.findUnique({
    where: { subscriptionId },
  });

  if (userPromotion) {
    await prisma.$transaction([
      prisma.userPromotion.delete({
        where: { subscriptionId },
      }),
      prisma.promotion.update({
        where: { id: userPromotion.promotionId },
        data: {
          currentRedemptions: { decrement: 1 },
        },
      }),
    ]);
  }
}

/**
 * Update subscription after successful Stripe payment
 */
export async function activateSubscription(
  userId: string,
  tier: SubscriptionTier,
  frequency: BillingFrequency,
  stripeData: {
    customerId: string;
    subscriptionId: string;
    priceId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }
): Promise<Subscription> {
  return prisma.subscription.update({
    where: { userId },
    data: {
      tier,
      status: SubscriptionStatus.ACTIVE,
      billingFrequency: frequency,
      tierStartedAt: new Date(),
      stripeCustomerId: stripeData.customerId,
      stripeSubscriptionId: stripeData.subscriptionId,
      stripePriceId: stripeData.priceId,
      currentPeriodStart: stripeData.currentPeriodStart,
      currentPeriodEnd: stripeData.currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
  });
}

/**
 * Cancel a subscription (at period end or immediately)
 */
export async function cancelSubscription(
  userId: string,
  immediately: boolean = false
): Promise<Subscription> {
  if (immediately) {
    return prisma.subscription.update({
      where: { userId },
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
  }

  return prisma.subscription.update({
    where: { userId },
    data: {
      cancelAtPeriodEnd: true,
    },
  });
}
