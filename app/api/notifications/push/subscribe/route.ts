import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { pushSubscribeSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '@/lib/notifications/push-limits';

/** Trimmed so a hostile client cannot use the label as unbounded storage. */
const MAX_USER_AGENT = 255;

export const POST = withAuth(async (request, session) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'pushSubscribe', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const parsed = pushSubscribeSchema.safeParse(await parseRequestBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const { endpoint, keys } = parsed.data;
    const userAgent = request.headers.get('user-agent')?.slice(0, MAX_USER_AGENT) ?? null;

    // The cap only applies to a genuinely new row. A browser re-subscribing
    // with an endpoint that already exists (permission re-granted, key
    // rotated, or even a different account that shared this browser) updates
    // that row rather than creating one, so it must not be blocked by the
    // cap or counted against it.
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
      select: { id: true },
    });

    if (!existing) {
      const count = await prisma.pushSubscription.count({
        where: { userId: session.user.id },
      });

      if (count >= MAX_PUSH_SUBSCRIPTIONS_PER_USER) {
        return NextResponse.json(
          { error: 'You have reached the maximum number of devices for push notifications' },
          { status: 409 }
        );
      }
    }

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
        // Re-subscribing is a deliberate act that proves the device is
        // reachable, so it clears any auto-disable from earlier failures.
        // Without this the autoDisabledAt filter in the driver would exclude
        // the row forever, since a browser re-subscribing reuses its endpoint.
        consecutiveFailures: 0,
        lastFailureCode: null,
        autoDisabledAt: null,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'push-subscribe');
  }
});
