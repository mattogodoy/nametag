import { z } from 'zod';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest } from '@/lib/validations';
import { createCheckoutSession, isPromotionActive } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { isSaasMode } from '@/lib/features';
import { getAppUrl } from '@/lib/env';

const checkoutSchema = z.object({
  tier: z.enum(['PERSONAL', 'PRO']),
  frequency: z.enum(['MONTHLY', 'YEARLY']),
  promotionCode: z.string().optional(),
});

// POST /api/billing/checkout - Create Stripe checkout session
export const POST = withAuth(async (request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(checkoutSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { tier, frequency } = validation.data;
    let { promotionCode } = validation.data;

    // If no promotion code provided, check if user has an active promotion applied
    if (!promotionCode) {
      const userPromotion = await prisma.userPromotion.findFirst({
        where: {
          subscription: { userId: session.user.id },
        },
        include: {
          promotion: true,
        },
      });

      if (userPromotion && isPromotionActive(userPromotion)) {
        promotionCode = userPromotion.promotion.code;
      }
    }

    // Get base URL for success/cancel redirects
    const appUrl = getAppUrl();
    const successUrl = `${appUrl}/settings/billing?success=true`;
    const cancelUrl = `${appUrl}/settings/billing?canceled=true`;

    const checkoutSession = await createCheckoutSession(
      session.user.id,
      session.user.email || '',
      session.user.name || undefined,
      tier,
      frequency,
      successUrl,
      cancelUrl,
      promotionCode
    );

    return apiResponse.ok({ url: checkoutSession.url });
  } catch (error) {
    return handleApiError(error, 'billing-checkout');
  }
}, { allowApiToken: false });
