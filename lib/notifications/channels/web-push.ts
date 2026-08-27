import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';
import { getVapidDetails } from '../vapid';
import { renderShortForm } from '../render';
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '../push-limits';
import { recordPushSubscriptionResult } from '../endpoint-health';
import type { OutboundFailureCode } from '../outbound';
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
 */
function failureCodeOf(statusCode: number | null): OutboundFailureCode {
  if (statusCode === null) return 'unknown';
  if (statusCode >= 500) return 'http_5xx';
  if (statusCode >= 400) return 'http_4xx';
  return 'unknown';
}

/**
 * Push one notification to every device the user has subscribed.
 *
 * Delivering to at least one device counts as delivered: a user with a dead
 * tablet and a live phone has been notified.
 */
export async function sendWebPush(envelope: NotificationEnvelope): Promise<ChannelOutcome> {
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
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload
      );
      delivered += 1;
      await recordPushSubscriptionResult(subscription.id, { ok: true });
    } catch (error) {
      const statusCode = statusCodeOf(error);
      lastError = error instanceof Error ? error.message : 'Unknown push error';

      if (statusCode !== null && DEAD_SUBSCRIPTION_CODES.has(statusCode)) {
        // Gone outright. The row is about to be deleted, so there is nothing
        // to record health against.
        dead.push(subscription.id);
      } else {
        log.warn(
          { userId: envelope.userId, statusCode, errorMessage: lastError },
          'Push delivery failed, keeping subscription'
        );
        await recordPushSubscriptionResult(subscription.id, {
          ok: false,
          code: failureCodeOf(statusCode),
        });
      }
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
