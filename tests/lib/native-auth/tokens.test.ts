import { describe, it, expect } from 'vitest';
import {
  issueTokenPair,
  ACCESS_TOKEN_PREFIX,
  REFRESH_TOKEN_PREFIX,
  ACCESS_TOKEN_TTL_MS,
} from '@/lib/native-auth/tokens';
import { hashToken } from '@/lib/token-hash';

describe('issueTokenPair', () => {
  const now = new Date('2026-10-17T10:00:00.000Z');

  it('issues prefixed tokens and stores only their hashes', () => {
    const pair = issueTokenPair(now);
    expect(pair.accessToken.startsWith(ACCESS_TOKEN_PREFIX)).toBe(true);
    expect(pair.refreshToken.startsWith(REFRESH_TOKEN_PREFIX)).toBe(true);
    expect(pair.accessTokenHash).toBe(hashToken(pair.accessToken));
    expect(pair.refreshTokenHash).toBe(hashToken(pair.refreshToken));
  });

  it('expires the access token one hour after issue', () => {
    expect(issueTokenPair(now).accessExpiresAt.getTime()).toBe(now.getTime() + ACCESS_TOKEN_TTL_MS);
    expect(ACCESS_TOKEN_TTL_MS).toBe(60 * 60 * 1000);
  });

  it('never repeats a token', () => {
    const a = issueTokenPair(now);
    const b = issueTokenPair(now);
    expect(a.accessToken).not.toBe(b.accessToken);
    expect(a.refreshToken).not.toBe(b.refreshToken);
  });
});
