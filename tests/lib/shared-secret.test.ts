import { describe, it, expect } from 'vitest';
import { hasValidBearerSecret, secretsMatch } from '@/lib/shared-secret';

function req(authorization?: string) {
  return new Request('http://localhost:3000/api/cron/example', {
    headers: authorization ? { authorization } : {},
  });
}

describe('secretsMatch', () => {
  it('accepts identical secrets', () => {
    expect(secretsMatch('a-long-shared-secret', 'a-long-shared-secret')).toBe(true);
  });

  it('rejects different secrets of the same length', () => {
    expect(secretsMatch('aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb')).toBe(false);
  });

  it('rejects secrets of different lengths without throwing', () => {
    expect(secretsMatch('short', 'a-much-longer-secret')).toBe(false);
  });

  it('handles multi-byte characters', () => {
    expect(secretsMatch('sécret-ñ', 'sécret-ñ')).toBe(true);
    expect(secretsMatch('sécret-ñ', 'secret-n')).toBe(false);
  });
});

describe('hasValidBearerSecret', () => {
  const secret = 'cron-secret-at-least-16';

  it('accepts a matching bearer token', () => {
    expect(hasValidBearerSecret(req(`Bearer ${secret}`), secret)).toBe(true);
  });

  it('is case-insensitive on the scheme', () => {
    expect(hasValidBearerSecret(req(`bearer ${secret}`), secret)).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(hasValidBearerSecret(req('Bearer nope'), secret)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(hasValidBearerSecret(req(), secret)).toBe(false);
  });

  it('rejects a malformed header', () => {
    expect(hasValidBearerSecret(req(secret), secret)).toBe(false);
    expect(hasValidBearerSecret(req('Basic dXNlcjpwYXNz'), secret)).toBe(false);
  });

  it('fails closed when no secret is configured', () => {
    // Without this guard a template literal would compare against the string
    // "Bearer undefined", which a caller could simply send.
    expect(hasValidBearerSecret(req('Bearer undefined'), undefined)).toBe(false);
    expect(hasValidBearerSecret(req('Bearer '), '')).toBe(false);
  });
});
