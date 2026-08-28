import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, withAuth } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAppUrl } from '@/lib/env';
import { getUserLocale } from '@/lib/locale';
import { sendNtfy } from '@/lib/notifications/channels/ntfy';
import { sendWebhook } from '@/lib/notifications/channels/webhook';
import { canUseWebhooks } from '@/lib/notifications/entitlements';
import { recordEndpointResult } from '@/lib/notifications/endpoint-health';
import type { NotificationEnvelope } from '@/lib/notifications/types';

/**
 * Send a sample notification to one endpoint.
 *
 * This is the most abusable surface in the feature: a synchronous outbound
 * request the caller controls, with the result returned immediately. It gets
 * the tightest rate limit in the app, and the response carries only the coarse
 * failure category that outbound.ts produces, never a body or a status line.
 */
export const POST = withAuth(async (request, session, context) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'notificationEndpointTest', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await context.params;

    const endpoint = await prisma.notificationEndpoint.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, type: true, url: true, secret: true, enabled: true },
    });

    if (!endpoint) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Re-checked here, not only at creation time, so a downgrade stops even a
    // manual test-send immediately, with no cleanup job to run.
    if (endpoint.type === 'WEBHOOK' && !(await canUseWebhooks(session.user.id))) {
      return NextResponse.json(
        { error: 'Outgoing webhooks require a Pro subscription', code: 'forbidden' },
        { status: 403 }
      );
    }

    const locale = await getUserLocale(session.user.id);

    const envelope: NotificationEnvelope = {
      userId: session.user.id,
      userEmail: '',
      locale,
      notification: {
        kind: 'contact',
        personId: 'test',
        personName: 'Nametag',
        lastContactFormatted: null,
        intervalText: '',
      },
      unsubscribeUrl: '',
      deepLink: `${getAppUrl()}/dashboard`,
      stamp: { model: 'person', id: 'test', field: 'lastContactReminderSent' },
      logMeta: {},
    };

    const result =
      endpoint.type === 'WEBHOOK'
        ? await sendWebhook(endpoint, envelope)
        : await sendNtfy(endpoint, envelope);

    // Record a success, but never a failure.
    //
    // A test send is the user actively debugging their receiver. Counting
    // those failures toward auto-disable would switch the endpoint off
    // underneath someone in the middle of fixing it, and the failure is
    // already reported to them synchronously below, so nothing is lost by
    // not storing it. A success still clears the counter, which is how a
    // user confirms a repaired endpoint is healthy again.
    //
    // Only record health for an endpoint that is actually in the nightly run.
    // Clearing the counters for a disabled row would wipe autoDisabledAt while
    // leaving enabled false, erasing the reason it was switched off. The user
    // clears that state deliberately, by re-enabling.
    if (result.ok && endpoint.enabled) {
      await recordEndpointResult(endpoint.id, result);
    }

    return NextResponse.json(
      result.ok ? { ok: true } : { ok: false, code: result.code }
    );
  } catch (error) {
    return handleApiError(error, 'notification-endpoint-test');
  }
});
