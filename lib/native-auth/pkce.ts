import { createHash, timingSafeEqual } from 'crypto';

/** App-generated state echoed back on the redirect (RFC 3986 unreserved chars). */
export const STATE_PATTERN = /^[A-Za-z0-9\-._~]{16,128}$/;
/** BASE64URL(SHA256(verifier)) without padding is always 43 chars. */
export const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** RFC 7636 section 4.1. */
export const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export function challengeFromVerifier(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  const expected = Buffer.from(challengeFromVerifier(verifier));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
