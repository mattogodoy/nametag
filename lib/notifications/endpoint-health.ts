import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';
import type { OutboundResult } from './outbound';

const log = createModuleLogger('notifications:endpoint-health');

/**
 * Consecutive failures before a destination is switched off.
 *
 * Ten daily runs is roughly a week and a half of a dead destination, which is
 * long enough to survive a receiver's own outage and short enough that we stop
 * making pointless outbound requests on a user's behalf.
 */
export const AUTO_DISABLE_THRESHOLD = 10;

/**
 * Record the outcome of one delivery attempt against a `NotificationEndpoint`
 * (webhook or ntfy topic).
 *
 * Only the coarse failure code is persisted. A response body or a precise
 * error string would surface on the settings page and turn a webhook into a
 * probe against whatever the server can reach.
 */
export async function recordEndpointResult(
  endpointId: string,
  result: OutboundResult
): Promise<void> {
  if (result.ok) {
    await prisma.notificationEndpoint.update({
      where: { id: endpointId },
      data: {
        consecutiveFailures: 0,
        lastSuccessAt: new Date(),
        lastFailureCode: null,
        autoDisabledAt: null,
      },
    });
    return;
  }

  const endpoint = await prisma.notificationEndpoint.findUnique({
    where: { id: endpointId },
    select: { consecutiveFailures: true },
  });

  // Deleted between the send and this write. Nothing to record.
  if (!endpoint) {
    return;
  }

  const failures = endpoint.consecutiveFailures + 1;
  const shouldDisable = failures >= AUTO_DISABLE_THRESHOLD;

  await prisma.notificationEndpoint.update({
    where: { id: endpointId },
    data: {
      consecutiveFailures: failures,
      lastFailureAt: new Date(),
      lastFailureCode: result.code,
      ...(shouldDisable ? { enabled: false, autoDisabledAt: new Date() } : {}),
    },
  });

  if (shouldDisable) {
    log.warn({ endpointId, failures }, 'Endpoint auto-disabled after repeated failures');
  }
}

/**
 * Record the outcome of one delivery attempt against a `PushSubscription`
 * (one browser/device).
 *
 * The same mechanism as {@link recordEndpointResult}, extended to push so a
 * VAPID key rotation or a corrupt `p256dh` has an exit other than failing
 * forever. `PushSubscription` has no `enabled` column: the 404/410 pruning
 * rule in `sendWebPush` already deletes a dead row outright, so disabling here
 * only ever means setting `autoDisabledAt`, never flipping a flag on a row
 * that might not exist.
 */
export async function recordPushSubscriptionResult(
  subscriptionId: string,
  result: OutboundResult
): Promise<void> {
  if (result.ok) {
    await prisma.pushSubscription.update({
      where: { id: subscriptionId },
      data: {
        consecutiveFailures: 0,
        lastSuccessAt: new Date(),
        lastFailureCode: null,
        autoDisabledAt: null,
      },
    });
    return;
  }

  const subscription = await prisma.pushSubscription.findUnique({
    where: { id: subscriptionId },
    select: { consecutiveFailures: true },
  });

  // Deleted (or already pruned as dead) between the send and this write.
  if (!subscription) {
    return;
  }

  const failures = subscription.consecutiveFailures + 1;
  const shouldDisable = failures >= AUTO_DISABLE_THRESHOLD;

  await prisma.pushSubscription.update({
    where: { id: subscriptionId },
    data: {
      consecutiveFailures: failures,
      lastFailureCode: result.code,
      ...(shouldDisable ? { autoDisabledAt: new Date() } : {}),
    },
  });

  if (shouldDisable) {
    log.warn({ subscriptionId, failures }, 'Push subscription auto-disabled after repeated failures');
  }
}
