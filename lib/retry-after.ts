/**
 * Seconds to wait after a 429 response body. Cooldown responses carry it in
 * params.retryAfter; the rate limiter carries it at the top level.
 */
export function getRetryAfterSeconds(data: unknown, fallback: number): number {
  if (typeof data !== 'object' || data === null) return fallback;
  const body = data as { params?: { retryAfter?: unknown }; retryAfter?: unknown };
  const value = body.params?.retryAfter ?? body.retryAfter;
  return typeof value === 'number' && value > 0 ? value : fallback;
}
