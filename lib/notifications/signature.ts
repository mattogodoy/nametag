import { createHmac, randomBytes } from 'node:crypto';

/**
 * Generate a webhook signing secret.
 *
 * 32 bytes from the CSPRNG, hex encoded. Shown to the user once at creation
 * and stored encrypted; there is no way to read it back, so a lost secret
 * means rotating the endpoint.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Sign a webhook payload, Stripe style.
 *
 * The signed message is `<timestamp>.<body>` rather than the body alone, so a
 * receiver that also checks the timestamp is fresh gets replay protection: an
 * attacker who captures a valid payload cannot re-send it later with a new
 * timestamp, because the signature would no longer match.
 *
 * The "." is load-bearing. Concatenating without a separator would let
 * ("12", "3abc") and ("123", "abc") produce the same signature.
 */
export function signPayload(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `sha256=${digest}`;
}
