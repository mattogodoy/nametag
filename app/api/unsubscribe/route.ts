import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { consumeUnsubscribeToken } from '@/lib/unsubscribe-tokens';
import { handleApiError, withLogging } from '@/lib/api-utils';
import { logger } from '@/lib/logger';

export const POST = withLogging(async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return apiError('bad_request', 'MISSING_TOKEN');
    }

    const result = await consumeUnsubscribeToken(token);

    if (!result.success) {
      return apiError('bad_request', result.error);
    }

    logger.info({
      userId: result.user.id,
      reminderType: result.reminderType,
      entityId: result.entityId,
    }, 'Reminder unsubscribed via email');

    return NextResponse.json({
      success: true,
      reminderType: result.reminderType,
    });
  } catch (error) {
    return handleApiError(error, 'unsubscribe');
  }
});
