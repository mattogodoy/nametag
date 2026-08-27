import { Prisma } from '@prisma/client';
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
 * The one piece of arithmetic `recordPushSubscriptionResult` needs: how many
 * failures this makes, and whether that crosses the disable line.
 *
 * `recordEndpointResult` does not use this. Its rows are shared across
 * concurrent envelopes for the same user, so it increments atomically in the
 * database instead of reading a count and writing it back (see the comment
 * there). `PushSubscription` health is not exposed to that same race today,
 * so the simpler read-then-write form is kept here.
 */
function nextFailureState(currentFailures: number): {
  failures: number;
  shouldDisable: boolean;
} {
  const failures = currentFailures + 1;
  return { failures, shouldDisable: failures >= AUTO_DISABLE_THRESHOLD };
}

/** True when a Prisma write targeted a row that no longer exists (P2025). */
function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

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
  const now = new Date();

  if (result.ok) {
    // `enabled` and `autoDisabledAt` are deliberately left untouched here.
    // Re-enabling is a user action taken through PUT, never a side effect of
    // a delivery succeeding: `loadEndpoints` snapshots the endpoint list once
    // per cron run, so a row that trips auto-disable partway through can
    // still see a later envelope in the same run succeed against the
    // stale, not-yet-disabled row. If success cleared `autoDisabledAt`, that
    // would produce `enabled: false, autoDisabledAt: null`, an endpoint that
    // renders as healthy, delivers nothing, and offers no way back. Keeping
    // the invariant "autoDisabledAt set implies enabled false" holding means
    // PUT is the only path that ever clears it, and it already sets both
    // together.
    try {
      await prisma.notificationEndpoint.update({
        where: { id: endpointId },
        data: {
          consecutiveFailures: 0,
          lastSuccessAt: now,
          lastFailureCode: null,
        },
      });
    } catch (error) {
      // Deleted between the send and this write. Nothing to record.
      if (isRecordNotFoundError(error)) return;
      throw error;
    }
    return;
  }

  // Atomic increment rather than a read-then-write. Concurrent envelopes for
  // the same user share the same endpoint rows (the cron dispatches many
  // envelopes per run, each hitting every enabled endpoint), so two updates
  // racing on a read-modify-write cycle lose one increment: both read the
  // same starting count, both write count + 1, and one failure vanishes.
  // Auto-disable then fires late, or never, on an endpoint that is actually
  // failing every time.
  let updated: { consecutiveFailures: number };
  try {
    updated = await prisma.notificationEndpoint.update({
      where: { id: endpointId },
      data: {
        consecutiveFailures: { increment: 1 },
        lastFailureAt: now,
        lastFailureCode: result.code,
      },
      select: { consecutiveFailures: true },
    });
  } catch (error) {
    // Deleted between the send and this write. Nothing to record.
    if (isRecordNotFoundError(error)) return;
    throw error;
  }

  if (updated.consecutiveFailures >= AUTO_DISABLE_THRESHOLD) {
    // Guarded on autoDisabledAt so concurrent envelopes crossing the
    // threshold together cannot each overwrite the disable timestamp.
    await prisma.notificationEndpoint.updateMany({
      where: { id: endpointId, autoDisabledAt: null },
      data: { enabled: false, autoDisabledAt: now },
    });
    log.warn(
      { endpointId, failures: updated.consecutiveFailures },
      'Endpoint auto-disabled after repeated failures'
    );
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

  const { failures, shouldDisable } = nextFailureState(subscription.consecutiveFailures);

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

/**
 * Ceiling on endpoints per user.
 *
 * Each endpoint is an outbound request per reminder made on the user's behalf.
 * Five covers a phone, a tablet and a couple of integrations, and keeps the
 * fan-out from one account bounded.
 */
export const MAX_ENDPOINTS_PER_USER = 5;
