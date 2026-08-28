/**
 * Map over items with a ceiling on how many callbacks run at once.
 *
 * The reminder cron can hold several hundred envelopes, and each non-email
 * channel is a separate outbound socket. Firing them all at once would open
 * hundreds of connections in one tick and invite rate limiting from the
 * receiving end, so work is pulled from a shared cursor by a fixed number of
 * workers instead.
 *
 * Results keep input order, so callers can zip them back against the input.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;

  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
