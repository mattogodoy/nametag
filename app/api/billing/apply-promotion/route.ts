import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { validateRequest } from '@/lib/validations';
import { applyPromotion } from '@/lib/billing';
import { isSaasMode } from '@/lib/features';

const applyPromotionSchema = z.object({
  code: z.string().min(1, 'Promotion code is required').max(50),
});

// POST /api/billing/apply-promotion - Apply promotion code
export const POST = withAuth(async (request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(applyPromotionSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { code } = validation.data;

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!subscription) {
      return apiResponse.notFound('Subscription not found');
    }

    const result = await applyPromotion(subscription.id, code);

    if (!result.success) {
      return apiResponse.error(result.error || 'Failed to apply promotion');
    }

    return apiResponse.message('Promotion applied successfully');
  } catch (error) {
    return handleApiError(error, 'billing-apply-promotion');
  }
}, { allowApiToken: false });
