import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, withAuth } from '@/lib/api-utils';
import { updateEndpointSchema } from '@/lib/validations';

export const PUT = withAuth(async (request, session, context) => {
  try {
    const parsed = updateEndpointSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const { id } = await context.params;

    // updateMany scoped by userId, not update by id: a plain update would let
    // any signed-in user re-enable or relabel another account's endpoint.
    //
    // Re-enabling clears the auto-disable state and the counter, so a user who
    // has fixed their receiver gets a clean slate rather than being switched
    // off again on the next single failure.
    const result = await prisma.notificationEndpoint.updateMany({
      where: { id, userId: session.user.id },
      data: {
        ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
        ...(parsed.data.enabled !== undefined
          ? parsed.data.enabled
            ? { enabled: true, autoDisabledAt: null, consecutiveFailures: 0, lastFailureCode: null }
            : { enabled: false }
          : {}),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-update');
  }
});

export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // Hard delete. A soft-deleted endpoint that a query forgot to filter would
    // keep firing at a URL the user believes they removed.
    const result = await prisma.notificationEndpoint.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-delete');
  }
});
