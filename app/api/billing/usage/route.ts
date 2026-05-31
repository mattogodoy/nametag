import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { getSubscriptionWithStatus } from '@/lib/billing';
import { isSaasMode } from '@/lib/features';

// GET /api/billing/usage - Get current usage vs limits
export const GET = withAuth(async (_request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const { usage, limits, subscription } = await getSubscriptionWithStatus(session.user.id);

    return apiResponse.ok({
      tier: subscription?.tier ?? 'FREE',
      usage,
      limits,
    });
  } catch (error) {
    return handleApiError(error, 'billing-usage');
  }
}, { allowApiToken: false });
