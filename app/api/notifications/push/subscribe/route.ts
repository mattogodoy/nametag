import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, withAuth } from '@/lib/api-utils';
import { pushSubscribeSchema } from '@/lib/validations';

/** Trimmed so a hostile client cannot use the label as unbounded storage. */
const MAX_USER_AGENT = 255;

export const POST = withAuth(async (request, session) => {
  try {
    const parsed = pushSubscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const { endpoint, keys } = parsed.data;
    const userAgent = request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT) ?? null;

    // Upsert on endpoint: a browser that re-subscribes (permission re-granted,
    // key rotated) reports the same endpoint and must update its row rather
    // than accumulate a duplicate that will never be delivered to.
    //
    // The update re-assigns userId on purpose: if two accounts share a browser
    // profile, the subscription belongs to whoever subscribed most recently,
    // and the previous owner must stop receiving that device's notifications.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
      update: {
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'push-subscribe');
  }
});
