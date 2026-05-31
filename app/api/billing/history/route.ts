import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { isSaasMode } from '@/lib/features';

// GET /api/billing/history - Get payment history
export const GET = withAuth(async (_request, session) => {
  // Billing endpoints are only available in SaaS mode
  if (!isSaasMode()) {
    return apiResponse.notFound('Not found');
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!subscription) {
      return apiResponse.ok({ payments: [] });
    }

    const payments = await prisma.paymentHistory.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 payments
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        originalAmount: true,
        discountAmount: true,
        promotionCode: true,
        paidAt: true,
        createdAt: true,
      },
    });

    return apiResponse.ok({ payments });
  } catch (error) {
    return handleApiError(error, 'billing-history');
  }
}, { allowApiToken: false });
