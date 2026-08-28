/**
 * Ceiling on how many push subscription rows one user may hold.
 *
 * Enforced when a device subscribes (`POST /api/notifications/push/subscribe`,
 * returning 409 past the cap) and again as a belt in the delivery driver's
 * `findMany` (`sendWebPush`). Without a cap, one account can insert
 * arbitrarily many rows with distinct endpoints, and the driver iterates them
 * sequentially with no time budget, once per envelope, so an abusive account
 * can stall or time out the nightly reminder run for the whole instance.
 *
 * 20 is generous for real devices (phone, laptop, tablet, a couple of
 * browsers) while still being a real ceiling.
 */
export const MAX_PUSH_SUBSCRIPTIONS_PER_USER = 20;
