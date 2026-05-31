import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { getSubscriptionWithStatus } from '@/lib/billing';
import { TIER_INFO } from '@/lib/billing/constants';
import { isSaasMode } from '@/lib/features';

// GET /api/billing/subscription - Get current subscription status
export const GET = withAuth(async (_request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const subscriptionData = await getSubscriptionWithStatus(session.user.id);

    const tier = subscriptionData.subscription?.tier ?? 'FREE';
    const tierInfo = TIER_INFO[tier];

    return apiResponse.ok({
      subscription: subscriptionData.subscription
        ? {
            id: subscriptionData.subscription.id,
            tier: subscriptionData.subscription.tier,
            status: subscriptionData.subscription.status,
            billingFrequency: subscriptionData.subscription.billingFrequency,
            tierStartedAt: subscriptionData.subscription.tierStartedAt,
            currentPeriodStart: subscriptionData.subscription.currentPeriodStart,
            currentPeriodEnd: subscriptionData.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscriptionData.subscription.cancelAtPeriodEnd,
          }
        : null,
      tierInfo,
      usage: subscriptionData.usage,
      limits: subscriptionData.limits,
      promotion: subscriptionData.subscription?.promotion
        ? {
            code: subscriptionData.subscription.promotion.promotion.code,
            description: subscriptionData.subscription.promotion.promotion.description,
            discountPercent: subscriptionData.subscription.promotion.promotion.discountPercent,
            isActive: subscriptionData.promotionActive,
            expiresAt: subscriptionData.promotionExpiry,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error, 'billing-subscription-get');
  }
}, { allowApiToken: false });
