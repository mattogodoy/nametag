/**
 * The one capability this helper needs from a transaction client.
 *
 * Typed structurally rather than as `Prisma.TransactionClient`: this project
 * builds its client through `@prisma/adapter-pg`, and the resulting extended
 * client is not assignable to the vanilla `TransactionClient` type. Asking
 * only for `$queryRaw` keeps the helper usable from any of them, and is an
 * honest statement of what it actually touches.
 */
interface RawQueryable {
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
}

/**
 * Take an exclusive row lock on a user for the rest of the transaction.
 *
 * This exists for per-user caps that are enforced by counting rows and then
 * inserting (notification endpoints, push subscriptions). Counting and then
 * inserting is a time-of-check-to-time-of-use gap: two concurrent requests
 * can each see a count under the limit and both succeed, leaving the user
 * over the cap. `READ COMMITTED`, which is Postgres's default and what Prisma
 * uses, does not close that gap on its own, because neither transaction has
 * written anything the other could conflict with at the time it counts.
 *
 * Locking the owning `users` row first serialises every capped insert for
 * that one user, so the count is taken under the same lock the insert
 * happens under. Contention is per user rather than global, and the critical
 * section is one count plus one insert, so the practical cost is nil.
 *
 * This deliberately locks the parent rather than using `SERIALIZABLE`
 * isolation: a serialization failure surfaces as a retryable error the caller
 * would then have to handle and possibly retry, whereas this simply blocks
 * for the microseconds the other insert takes.
 *
 * Must be called with a transaction client, never the base client. Outside a
 * transaction the lock is released immediately and this does nothing at all.
 */
export async function lockUserRow(tx: RawQueryable, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}
