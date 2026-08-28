import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';
import { getVapidDetails } from '../vapid';
import { renderShortForm } from '../render';
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '../push-limits';
import type { HealthAccumulator } from '../endpoint-health';
import {
  TIMEOUT_MS,
  httpStatusToFailureCode,
  type OutboundFailureCode,
} from '../outbound';
import type { ChannelOutcome, NotificationEnvelope } from '../types';

const log = createModuleLogger('notifications:push');

/**
 * Status codes that mean the subscription is permanently dead.
 *
 * 404 and 410 come from the push service itself and mean the browser has
 * discarded the subscription (cleared site data, uninstalled the PWA,
 * permission revoked). Anything else, including 5xx, is transient and must not
 * delete the row, or a brief outage at the push service would silently
 * unsubscribe the whole user base. This rule is deliberate and must not
 * change: auto-disable (see `recordPushSubscriptionResult`) is the exit for a
 * device that keeps failing for some other reason, such as a VAPID key
 * rotation, where every device would otherwise report the same status.
 */
const DEAD_SUBSCRIPTION_CODES = new Set([404, 410]);

function statusCodeOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const code = (error as { statusCode: unknown }).statusCode;
    return typeof code === 'number' ? code : null;
  }
  return null;
}

/**
 * Map a push service status onto the same coarse categories the outbound
 * client uses, so a settings page showing endpoint health and one showing
 * device health can share language.
 *
 * Delegates to outbound.ts's httpStatusToFailureCode rather than repeating
 * the >=400/>=500 split here: two independent copies of that split is how a
 * push service's own 429 would end up mis-filed as http_4xx again.
 */
function failureCodeOf(statusCode: number | null): OutboundFailureCode {
  if (statusCode === null) return 'unknown';
  return httpStatusToFailureCode(statusCode);
}

/** Thrown when the total deadline below fires before web-push settles. */
class WebPushDeadlineError extends Error {
  constructor() {
    super('Total deadline exceeded');
    this.name = 'WebPushDeadlineError';
  }
}

/**
 * Send one push message with a real total deadline.
 *
 * The `timeout` option passed to `webpush.sendNotification` below is not a
 * total deadline: the library forwards it straight to `https.request`, which
 * treats it as a socket-inactivity timer that resets on every inbound byte.
 * That is exactly the trickling-server case outbound.ts has its own separate
 * deadline timer to defend against (see the dedicated test for it in
 * tests/lib/notifications/outbound.test.ts). Without a matching guard here, a
 * push service that dribbles bytes without ever completing the response would
 * stall this send, and by extension the whole nightly run, indefinitely.
 *
 * This cannot abort the underlying request (the library exposes no handle for
 * that), so a late resolution or rejection from `sendNotification` after the
 * deadline has already fired is simply ignored rather than left to become an
 * unhandled rejection.
 */
function sendWithDeadline(
  subscription: Parameters<typeof webpush.sendNotification>[0],
  payload: string
): Promise<webpush.SendResult> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const deadline = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new WebPushDeadlineError());
      }
    }, TIMEOUT_MS);
    deadline.unref?.();

    webpush
      .sendNotification(subscription, payload, { timeout: TIMEOUT_MS })
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(deadline);
          resolve(result);
        }
      })
      .catch((error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(deadline);
          reject(error);
        }
      });
  });
}

/**
 * Push one notification to every device the user has subscribed.
 *
 * Delivering to at least one device counts as delivered: a user with a dead
 * tablet and a live phone has been notified.
 *
 * Per-device outcomes are recorded into `health` rather than written
 * immediately: the caller (dispatchAll) flushes it once after every envelope
 * in the run has gone through, so a device with many envelopes tonight gets
 * one health write, not one per envelope.
 */
export async function sendWebPush(
  envelope: NotificationEnvelope,
  health: HealthAccumulator
): Promise<ChannelOutcome> {
  const vapid = getVapidDetails();
  if (!vapid) {
    return { channel: 'web_push', status: 'skipped' };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: envelope.userId, autoDisabledAt: null },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
    // Belt, not the primary control: the cap is enforced at subscribe time.
    // This only matters if rows already exceeded it (data migrated in, cap
    // lowered later), and keeps one such account from making this driver
    // iterate an unbounded list once per envelope.
    take: MAX_PUSH_SUBSCRIPTIONS_PER_USER,
  });

  if (subscriptions.length === 0) {
    return { channel: 'web_push', status: 'skipped' };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const { title, body } = await renderShortForm(envelope);
  const tag = `${envelope.notification.kind}:${envelope.stamp.id}`;
  const payload = JSON.stringify({ title, body, url: envelope.deepLink, tag });

  const dead: string[] = [];
  let delivered = 0;
  let lastError = 'Unknown push error';

  for (const subscription of subscriptions) {
    // The send itself lives in its own try/catch, kept separate from health
    // recording below, so a bookkeeping error can never be mistaken for (or
    // cause) a delivery failure.
    let sendError: { statusCode: number | null; message: string; code?: OutboundFailureCode } | null =
      null;

    try {
      await sendWithDeadline(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload
      );
    } catch (error) {
      if (error instanceof WebPushDeadlineError) {
        // No statusCode at all: the send never got a response before this
        // channel's own total deadline fired. Explicit 'timeout' rather than
        // falling through statusCodeOf(error) to 'unknown', so this reads the
        // same way outbound.ts's own timeout does.
        sendError = { statusCode: null, message: error.message, code: 'timeout' };
      } else {
        sendError = {
          statusCode: statusCodeOf(error),
          message: error instanceof Error ? error.message : 'Unknown push error',
        };
      }
    }

    if (sendError === null) {
      delivered += 1;
      health.recordSubscription(subscription.id, { ok: true });
      continue;
    }

    const { statusCode, message, code } = sendError;
    lastError = message;

    if (statusCode !== null && DEAD_SUBSCRIPTION_CODES.has(statusCode)) {
      // Gone outright. The row is about to be deleted, so there is nothing
      // to record health against.
      dead.push(subscription.id);
    } else {
      log.warn(
        { userId: envelope.userId, statusCode, errorMessage: message },
        'Push delivery failed, keeping subscription'
      );
      health.recordSubscription(subscription.id, { ok: false, code: code ?? failureCodeOf(statusCode) });
    }
  }

  if (dead.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    log.info({ userId: envelope.userId, pruned: dead.length }, 'Pruned dead push subscriptions');
  }

  if (delivered === 0) {
    return { channel: 'web_push', status: 'failed', error: lastError };
  }

  return { channel: 'web_push', status: 'delivered' };
}
