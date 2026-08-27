import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, withAuth } from '@/lib/api-utils';

export const DELETE = withAuth(async (_request, session, context) => {
  try {
    const { id } = await context.params;

    // deleteMany with userId in the filter, not delete by id. A plain delete
    // would let any signed-in user revoke another account's device by guessing
    // an id, and would 404-vs-200 leak which ids exist.
    const result = await prisma.pushSubscription.deleteMany({
      where: { id, userId: session.user.id },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'push-unsubscribe');
  }
});
