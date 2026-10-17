import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { pushStatusSchema } from '@/lib/validations';

/**
 * Tells a browser whether its own push subscription is registered to the
 * current account.
 *
 * A browser keeps its PushSubscription after its row is removed from the
 * device list, whether from that browser or another one, so the local
 * subscription alone cannot tell the settings page whether push is really on.
 *
 * The browser sends its endpoint rather than the server sending the list of
 * endpoints down. The settings page never exposes endpoint strings: anyone who
 * learns one can move that row to their own account through the subscribe
 * upsert. Answering only "is this one yours" reveals nothing the caller does
 * not already hold.
 */
export const POST = withAuth(async (request, session) => {
  try {
    const parsed = pushStatusSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Scoped by userId: a row that belongs to another account sharing this
    // browser is not registered for this one.
    const subscription = await prisma.pushSubscription.findFirst({
      where: { endpoint: parsed.data.endpoint, userId: session.user.id },
      select: { id: true },
    });

    return NextResponse.json({ registered: subscription !== null });
  } catch (error) {
    return handleApiError(error, 'push-status');
  }
});
