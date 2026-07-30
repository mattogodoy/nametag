import { timingSafeEqual } from 'node:crypto';

/**
 * Compare two secrets without leaking their contents through timing.
 *
 * `timingSafeEqual` throws when the buffers differ in length, which would
 * itself reveal the expected length, so the lengths are compared first and a
 * mismatch short-circuits to false.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Verify an `Authorization: Bearer <secret>` header against a shared secret.
 *
 * Returns false when the header is missing or malformed, or when the configured
 * secret is empty, so a deployment that forgot to set the secret fails closed
 * instead of accepting `Bearer undefined`.
 */
export function hasValidBearerSecret(
  request: Request,
  expected: string | undefined
): boolean {
  if (!expected) {
    return false;
  }

  const header = request.headers.get('authorization');
  if (!header) {
    return false;
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return false;
  }

  return secretsMatch(match[1].trim(), expected);
}
