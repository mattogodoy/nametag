/**
 * Deadlock handling for delta sync writes.
 *
 * Every write to a synced table bumps the owner's counter in a trigger, which
 * takes the user-row lock after Postgres has already locked the entity row.
 * Two transactions for the same user can therefore deadlock: one holds the
 * user lock and wants an entity the other holds, while the other holds that
 * entity and waits for the user lock. Postgres aborts one of them (40P01).
 * Nothing was committed by the aborted one, so running it again is safe.
 */

const DEADLOCK = '40P01';
const MAX_ATTEMPTS = 3;

function codeOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'code' in value ? value.code : undefined;
}

/** True for a Postgres deadlock, however the driver adapter wraps it. */
export function isDeadlock(error: unknown): boolean {
  if (codeOf(error) === DEADLOCK) return true;
  const cause = typeof error === 'object' && error !== null && 'cause' in error ? error.cause : undefined;
  return codeOf(cause) === DEADLOCK;
}

/**
 * Runs `fn`, running it again (up to 3 attempts) when Postgres aborts it as a
 * deadlock victim. `fn` must be a whole transaction or a standalone statement:
 * inside a transaction the deadlock has already aborted everything.
 */
export async function withDeadlockRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS || !isDeadlock(error)) throw error;
      // A short random pause so the two sides do not collide again.
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40 * attempt));
    }
  }
}
