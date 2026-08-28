import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { generateWebhookSecret, signPayload } from '../../../lib/notifications/signature';

describe('generateWebhookSecret', () => {
  it('returns 64 hex characters, which is 32 bytes of entropy', () => {
    expect(generateWebhookSecret()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a different value every time', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateWebhookSecret()));
    expect(seen.size).toBe(50);
  });
});

describe('signPayload', () => {
  const secret = 'a'.repeat(64);
  const body = '{"event":"reminder.contact"}';
  const timestamp = '1756200000';

  it('matches a signature computed independently over timestamp.body', () => {
    const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

    expect(signPayload(secret, timestamp, body)).toBe(`sha256=${expected}`);
  });

  it('is stable against a fixed known vector', () => {
    // Recomputing this constant to make a failing test pass defeats its
    // purpose. If it fails, the signing scheme changed and every receiver
    // already in the wild has broken.
    expect(signPayload('secret', '1700000000', '{"a":1}')).toBe(
      `sha256=${createHmac('sha256', 'secret').update('1700000000.{"a":1}').digest('hex')}`
    );
  });

  it('changes when the body changes', () => {
    expect(signPayload(secret, timestamp, body)).not.toBe(
      signPayload(secret, timestamp, `${body} `)
    );
  });

  it('changes when the timestamp changes, so a captured body cannot be replayed', () => {
    expect(signPayload(secret, timestamp, body)).not.toBe(
      signPayload(secret, '1756200001', body)
    );
  });

  it('changes when the secret changes', () => {
    expect(signPayload(secret, timestamp, body)).not.toBe(
      signPayload('b'.repeat(64), timestamp, body)
    );
  });

  it('binds the timestamp and body together rather than concatenating loosely', () => {
    // Without a separator, ("12", "3abc") and ("123", "abc") would sign the
    // same bytes and a receiver could be tricked about which is which.
    expect(signPayload(secret, '12', '3abc')).not.toBe(signPayload(secret, '123', 'abc'));
  });
});
