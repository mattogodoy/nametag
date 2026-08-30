import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { pushSubscribeSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '@/lib/notifications/push-limits';
import { lockUserRow } from '@/lib/db/user-lock';

/** Thrown inside the subscribe transaction when the per-user device cap is met. */
class PushSubscriptionCapReachedError extends Error {}

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

    // The existence check, the cap count and the write all happen under one
    // exclusive lock on the owning user row. Checking a count and then
    // inserting is a time-of-check-to-time-of-use gap: two concurrent
    // subscribes can each see a count under the cap and both create a row,
    // leaving the user over it. The same fix is applied to the notification
    // endpoint cap; see lib/db/user-lock.ts for why locking the parent row
    // is the mechanism rather than SERIALIZABLE isolation.
    try {
      await prisma.$transaction(async (tx) => {
        await lockUserRow(tx, session.user.id);

        // The cap only applies to a genuinely new row. A browser re-subscribing
        // with an endpoint that already exists (permission re-granted, key
        // rotated, or even a different account that shared this browser) updates
        // that row rather than creating one, so it must not be blocked by the
        // cap or counted against it.
        const existing = await tx.pushSubscription.findUnique({
          where: { endpoint },
          select: { id: true },
        });

        if (!existing) {
          const count = await tx.pushSubscription.count({
            where: { userId: session.user.id },
          });

          if (count >= MAX_PUSH_SUBSCRIPTIONS_PER_USER) {
            throw new PushSubscriptionCapReachedError();
          }
        }

        // Upsert on endpoint: a browser that re-subscribes (permission re-granted,
        // key rotated) reports the same endpoint and must update its row rather
        // than accumulate a duplicate that will never be delivered to.
        //
        // The update re-assigns userId on purpose: if two accounts share a browser
        // profile, the subscription belongs to whoever subscribed most recently,
        // and the previous owner must stop receiving that device's notifications.
        await tx.pushSubscription.upsert({
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
      });
    } catch (error) {
      // Lost the race for the last slot. The transaction rolled back, so
      // nothing was written.
      if (error instanceof PushSubscriptionCapReachedError) {
        return NextResponse.json(
          { error: 'You have reached the maximum number of devices for push notifications' },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'push-subscribe');
  }
});
