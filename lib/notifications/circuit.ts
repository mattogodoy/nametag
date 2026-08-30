import type { OutboundFailureCode } from './outbound';

/**
 * Failure codes that mean "this destination is not reachable tonight".
 *
 * These are the codes that cost wall-clock time. A timeout burns the full
 * TIMEOUT_MS before it resolves, and a DNS or connection failure burns however
 * long the resolver or the TCP handshake takes. Retrying the same destination
 * for the next envelope in the same run pays that cost again for an outcome
 * that is not going to be different seconds later.
 *
 * Deliberately excluded:
 *
 * - `http_429` and `http_5xx`: the destination answered, so they cost almost
 *   nothing, and both are genuinely transient. A receiver rate-limiting one
 *   message may well accept the next.
 * - `http_4xx` and `unexpected_response`: also cheap, because the destination
 *   answered promptly. There is no run-time saving in short-circuiting them,
 *   and letting each envelope record its own outcome keeps the health picture
 *   honest.
 *
 * So this trades away nothing but repeated waiting.
 */
const UNREACHABLE_CODES: ReadonlySet<OutboundFailureCode> = new Set([
  'timeout',
  'dns',
  'refused',
  'tls',
  'blocked',
]);

/**
 * Remembers, for the duration of one cron run, which destinations were found
 * unreachable, so the run stops paying their timeout again per envelope.
 *
 * The nightly run holds one envelope per due reminder, and every one of them
 * is delivered to every destination the recipient has. Without this, a user
 * with five blackholed destinations and twenty due reminders contributes
 * 5 x 20 x TIMEOUT_MS, about 500 seconds, to a shared worker pool: one
 * account degrading the whole instance's reminders for the night. With it,
 * that cost stops scaling with the reminder count: once a destination has
 * failed, every later envelope resolves instantly with the code that tripped
 * the breaker.
 *
 * The bound this gives is per concurrency wave, not per run: the pass runs
 * CHANNEL_CONCURRENCY envelopes at once, so up to that many attempts against
 * the same destination can already be in flight before the first one fails
 * and trips the breaker. A destination therefore costs at most
 * CHANNEL_CONCURRENCY timeouts per run rather than one per envelope, which is
 * what turns the endpoint pass from O(envelopes) waiting into O(destinations)
 * waiting. Collapsing that last factor to exactly one would mean serialising
 * the first attempt per destination behind a shared latch, and a latch that
 * fails to release on some error path deadlocks the entire nightly run: not a
 * trade worth making for a constant factor of ten.
 *
 * Scoped to a single run and never persisted. Reachability is retried from
 * scratch on the next run, which is what keeps a receiver's brief outage from
 * having any effect beyond that night. Persistent failure is already handled
 * separately, and more slowly, by the auto-disable counter.
 *
 * Every skipped attempt is still reported as a failure to its envelope and
 * still recorded against the destination's health, so short-circuiting cannot
 * make a broken destination look healthy, or stop it eventually auto-disabling.
 */
export class RunCircuitBreaker {
  // Two maps rather than one keyed by a bare id, mirroring HealthAccumulator.
  // `NotificationEndpoint` and `PushSubscription` ids come from different
  // tables, so a single shared map would let an id collision between them
  // silence one destination because an unrelated one failed. Separate maps
  // make that impossible by construction rather than by assuming ids never
  // repeat across tables.
  private readonly endpoints = new Map<string, OutboundFailureCode>();
  private readonly subscriptions = new Map<string, OutboundFailureCode>();

  private static set(
    map: Map<string, OutboundFailureCode>,
    id: string,
    code: OutboundFailureCode
  ): void {
    if (UNREACHABLE_CODES.has(code)) {
      map.set(id, code);
    }
  }

  /**
   * Record an endpoint outcome. Only a code in UNREACHABLE_CODES trips the
   * breaker; anything else, including a success, leaves it closed.
   */
  recordEndpoint(endpointId: string, code: OutboundFailureCode): void {
    RunCircuitBreaker.set(this.endpoints, endpointId, code);
  }

  /** Record a push subscription outcome. Same rule as recordEndpoint. */
  recordSubscription(subscriptionId: string, code: OutboundFailureCode): void {
    RunCircuitBreaker.set(this.subscriptions, subscriptionId, code);
  }

  /**
   * The code that tripped this endpoint earlier in the run, or null if it is
   * still worth attempting.
   */
  endpointTrippedCode(endpointId: string): OutboundFailureCode | null {
    return this.endpoints.get(endpointId) ?? null;
  }

  /** As endpointTrippedCode, for a push subscription. */
  subscriptionTrippedCode(subscriptionId: string): OutboundFailureCode | null {
    return this.subscriptions.get(subscriptionId) ?? null;
  }

  /** How many destinations were given up on this run, for logging. */
  get size(): number {
    return this.endpoints.size + this.subscriptions.size;
  }
}
