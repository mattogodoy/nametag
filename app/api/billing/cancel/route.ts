import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest } from '@/lib/validations';
import { cancelStripeSubscription, cancelSubscription } from '@/lib/billing';
import { sendSubscriptionCanceledEmail } from '@/lib/billing/emails';
import { isSaasMode } from '@/lib/features';

const cancelSchema = z.object({
  immediately: z.boolean().optional().default(false),
  reason: z.string().max(500).optional(),
});

// POST /api/billing/cancel - Cancel subscription
export const POST = withAuth(async (request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(cancelSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { immediately } = validation.data;

    // Get current subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: {
        tier: true,
        stripeSubscriptionId: true,
        currentPeriodEnd: true,
      },
    });

    if (!subscription) {
      return apiResponse.notFound('Subscription not found');
    }

    if (subscription.tier === 'FREE') {
      return apiResponse.error('Cannot cancel a free subscription');
    }

    if (!subscription.stripeSubscriptionId) {
      return apiResponse.error('No active Stripe subscription found');
    }

    // Cancel in Stripe and get the updated subscription
    const stripeSubscription = await cancelStripeSubscription(subscription.stripeSubscriptionId, immediately);

    // Get period end from Stripe subscription items (in newer API versions, it's on items, not subscription)
    const subscriptionItem = stripeSubscription.items?.data?.[0];
    const periodEndTimestamp = subscriptionItem?.current_period_end;

    const periodEnd = periodEndTimestamp ? new Date(periodEndTimestamp * 1000) : subscription.currentPeriodEnd;

    // Update local subscription
    await cancelSubscription(session.user.id, immediately);

    // Send cancellation email
    await sendSubscriptionCanceledEmail(
      session.user.id,
      subscription.tier,
      periodEnd,
      immediately
    );

    return apiResponse.message(
      immediately
        ? 'Subscription canceled immediately'
        : 'Subscription will be canceled at the end of the billing period'
    );
  } catch (error) {
    return handleApiError(error, 'billing-cancel');
  }
}, { allowApiToken: false });
