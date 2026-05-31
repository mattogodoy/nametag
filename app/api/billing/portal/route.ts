import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { createBillingPortalSession } from '@/lib/billing';
import { isSaasMode } from '@/lib/features';
import { getAppUrl } from '@/lib/env';

// POST /api/billing/portal - Create Stripe billing portal session
export const POST = withAuth(async (_request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const returnUrl = `${getAppUrl()}/settings/billing`;

    const portalSession = await createBillingPortalSession(
      session.user.id,
      returnUrl
    );

    return apiResponse.ok({ url: portalSession.url });
  } catch (error) {
    if (error instanceof Error && error.message === 'No Stripe customer found for this user') {
      return apiResponse.error('You need an active subscription to access the billing portal', 400);
    }
    return handleApiError(error, 'billing-portal');
  }
}, { allowApiToken: false });
