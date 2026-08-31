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
import type { OutboundResult } from '@/lib/notifications/outbound';
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
    const { id } = await context.params;

    // A cheap per-user bound BEFORE anything is looked up, so the query below
    // is never unmetered. The per-destination limit that follows cannot go
    // here: its key is built from a validated endpoint id, and validating one
    // is exactly what this guards.
    const userRateLimitResponse = checkRateLimit(
      request,
      'notificationEndpointTestPerUser',
      session.user.id
    );
    if (userRateLimitResponse) return userRateLimitResponse;

    const endpoint = await prisma.notificationEndpoint.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, type: true, url: true, secret: true, enabled: true },
    });

    if (!endpoint) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Keyed per destination now that the id is known to exist and to belong
    // to the caller. Keying on the raw path parameter instead would let a
    // caller mint unbounded buckets in the limiter's store by inventing ids,
    // and would let anyone who guessed a victim's endpoint id burn through
    // that victim's allowance.
    const rateLimitResponse = checkRateLimit(
      request,
      'notificationEndpointTest',
      `endpoint:${endpoint.id}`
    );
    if (rateLimitResponse) return rateLimitResponse;

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

    let result: OutboundResult;

    // An exhaustive switch, not a ternary: sendNtfy decrypts the stored
    // secret straight into an `Authorization: Bearer` header, so a
    // default-to-ntfy ternary would route a future third endpoint type there
    // by default and hand its secret to sendNtfy as if it were an ntfy
    // token, a credential leak rather than a labelling bug. The `never`
    // check below turns adding a type into a compile error here instead. See
    // the matching switch in lib/notifications/dispatch.ts.
    switch (endpoint.type) {
      case 'WEBHOOK':
        result = await sendWebhook(endpoint, envelope);
        break;
      case 'NTFY':
        result = await sendNtfy(endpoint, envelope);
        break;
      default: {
        const unhandled: never = endpoint.type;
        throw new Error(`Unhandled endpoint type: ${JSON.stringify(unhandled)}`);
      }
    }

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
