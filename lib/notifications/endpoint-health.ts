import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createModuleLogger } from '@/lib/logger';
import type { OutboundFailureCode, OutboundResult } from './outbound';

const log = createModuleLogger('notifications:endpoint-health');

/**
 * Consecutive failures before a destination is switched off.
 *
 * Ten daily runs is roughly a week and a half of a dead destination, which is
 * long enough to survive a receiver's own outage and short enough that we stop
 * making pointless outbound requests on a user's behalf.
 *
 * This is only true because health is written at most once per destination
 * per cron run (see HealthAccumulator below). A user with a weekly digest and
 * a couple of birthdays due the same night has 10+ envelopes in a single run;
 * counting per envelope instead of per run would let one hour of downtime
 * permanently disable a destination, which is not what this comment, or the
 * self-hosting docs that repeat it, describe.
 */
export const AUTO_DISABLE_THRESHOLD = 10;

/** True when a Prisma write targeted a row that no longer exists (P2025). */
function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

/**
 * Whether a failure code should count toward the consecutive-failure counter
 * that drives auto-disable.
 *
 * `http_429` is excluded: it means the destination itself asked us to slow
 * down, which is transient by definition. Disabling a destination because its
 * own server told us to back off is the wrong response, and it is a
 * particularly bad one for ntfy.sh's free-tier daily quota, where a user who
 * simply sends a lot of reminders would otherwise see a perfectly working
 * destination switched off with a message that blames their access token.
 * `lastFailureCode` and `lastFailureAt` are still recorded for every failure,
 * including this one, so the reason stays visible.
 */
function countsTowardAutoDisable(code: OutboundFailureCode): boolean {
  return code !== 'http_429';
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
  const bumpCounter = countsTowardAutoDisable(result.code);

  let updated: { consecutiveFailures: number };
  try {
    updated = await prisma.notificationEndpoint.update({
      where: { id: endpointId },
      data: {
        ...(bumpCounter ? { consecutiveFailures: { increment: 1 } } : {}),
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

  if (bumpCounter && updated.consecutiveFailures >= AUTO_DISABLE_THRESHOLD) {
    // Guarded on autoDisabledAt so concurrent envelopes crossing the
    // threshold together cannot each overwrite the disable timestamp, and so
    // the warning below fires once rather than on every subsequent failure
    // (a second envelope to the same already-disabled endpoint, later in the
    // same run, still has consecutiveFailures >= threshold but must not log
    // a second "auto-disabled" line for something that already happened).
    const disabled = await prisma.notificationEndpoint.updateMany({
      where: { id: endpointId, autoDisabledAt: null },
      data: { enabled: false, autoDisabledAt: now },
    });
    if (disabled.count > 0) {
      log.warn(
        { endpointId, failures: updated.consecutiveFailures },
        'Endpoint auto-disabled after repeated failures'
      );
    }
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
    // Unlike NotificationEndpoint, PushSubscription has no `enabled` column,
    // so clearing autoDisabledAt here has no counterpart flag to leave
    // stranded. This is the documented re-subscribe behaviour and is
    // intentionally different from recordEndpointResult's success path.
    try {
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          consecutiveFailures: 0,
          lastSuccessAt: new Date(),
          lastFailureCode: null,
          autoDisabledAt: null,
        },
      });
    } catch (error) {
      // Deleted (or already pruned as dead) between the send and this write.
      if (isRecordNotFoundError(error)) return;
      throw error;
    }
    return;
  }

  // Atomic increment, the same reasoning as recordEndpointResult: concurrent
  // envelopes for the same user share the same subscription rows, so a
  // read-then-write here loses increments under the same race.
  const bumpCounter = countsTowardAutoDisable(result.code);

  let updated: { consecutiveFailures: number };
  try {
    updated = await prisma.pushSubscription.update({
      where: { id: subscriptionId },
      data: {
        ...(bumpCounter ? { consecutiveFailures: { increment: 1 } } : {}),
        lastFailureCode: result.code,
      },
      select: { consecutiveFailures: true },
    });
  } catch (error) {
    // Deleted (or already pruned as dead) between the send and this write.
    if (isRecordNotFoundError(error)) return;
    throw error;
  }

  if (bumpCounter && updated.consecutiveFailures >= AUTO_DISABLE_THRESHOLD) {
    // Guarded on autoDisabledAt so concurrent envelopes crossing the
    // threshold together cannot each overwrite the disable timestamp, and so
    // the warning below fires once rather than on every subsequent failure.
    const disabled = await prisma.pushSubscription.updateMany({
      where: { id: subscriptionId, autoDisabledAt: null },
      data: { autoDisabledAt: new Date() },
    });
    if (disabled.count > 0) {
      log.warn(
        { subscriptionId, failures: updated.consecutiveFailures },
        'Push subscription auto-disabled after repeated failures'
      );
    }
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

interface AccumulatedOutcome {
  delivered: boolean;
  lastFailureCode: OutboundFailureCode;
}

function outcomeOf(acc: AccumulatedOutcome): OutboundResult {
  return acc.delivered ? { ok: true } : { ok: false, code: acc.lastFailureCode };
}

/**
 * Collects delivery outcomes for every destination touched during one cron
 * run, so health is written once per destination per run instead of once per
 * (envelope, destination) pair.
 *
 * The per-call writes this replaces are what made AUTO_DISABLE_THRESHOLD's
 * own "ten daily runs" comment false: a user with a weekly digest plus a few
 * birthday reminders due the same night has ten or more envelopes in a single
 * run, so one hour of a destination's downtime could cross the threshold
 * before morning. Aggregating first means the counter advances at most once
 * per destination per night, matching what the threshold's name promises.
 *
 * Aggregation rule: delivered to at least once during the run counts as a
 * success, recorded at flush time regardless of how many other envelopes in
 * the same run failed against that destination. Otherwise the last failure
 * code seen is recorded. This is deliberately the same "at least one success
 * counts" rule sendWebPush already uses across a user's own devices, applied
 * here across a run's envelopes instead of across devices.
 */
export class HealthAccumulator {
  private readonly endpoints = new Map<string, AccumulatedOutcome>();
  private readonly subscriptions = new Map<string, AccumulatedOutcome>();

  private static accumulate(
    map: Map<string, AccumulatedOutcome>,
    id: string,
    result: OutboundResult
  ): void {
    const existing = map.get(id);
    if (result.ok) {
      map.set(id, { delivered: true, lastFailureCode: existing?.lastFailureCode ?? 'unknown' });
      return;
    }
    map.set(id, { delivered: existing?.delivered ?? false, lastFailureCode: result.code });
  }

  /** Record one envelope's outcome against one notification endpoint. Synchronous: purely in-memory, cannot fail. */
  recordEndpoint(endpointId: string, result: OutboundResult): void {
    HealthAccumulator.accumulate(this.endpoints, endpointId, result);
  }

  /** Record one envelope's outcome against one push subscription. Synchronous: purely in-memory, cannot fail. */
  recordSubscription(subscriptionId: string, result: OutboundResult): void {
    HealthAccumulator.accumulate(this.subscriptions, subscriptionId, result);
  }

  /**
   * Write exactly one health record per destination accumulated this run.
   *
   * Called once, after every envelope in the run has already been delivered
   * (or not) and every DispatchResult has already been computed. Nothing here
   * can change a delivery outcome or a stamp decision: it only updates
   * `NotificationEndpoint` / `PushSubscription` bookkeeping columns.
   *
   * Each destination's write is guarded on its own, the same way the
   * per-call writes it replaces were guarded: one destination's write failing
   * (a transient DB blip) must not stop the rest of the run's destinations
   * from being flushed, and must never propagate out to the caller.
   */
  async flush(): Promise<void> {
    for (const [endpointId, acc] of this.endpoints) {
      try {
        await recordEndpointResult(endpointId, outcomeOf(acc));
      } catch (error) {
        log.warn(
          {
            endpointId,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to flush endpoint health for this run'
        );
      }
    }

    for (const [subscriptionId, acc] of this.subscriptions) {
      try {
        await recordPushSubscriptionResult(subscriptionId, outcomeOf(acc));
      } catch (error) {
        log.warn(
          {
            subscriptionId,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          },
          'Failed to flush push subscription health for this run'
        );
      }
    }
  }
}
