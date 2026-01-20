import { describe, it, expect, beforeEach, vi } from 'vitest';
import { blacklistToken, isTokenBlacklisted } from '@/lib/token-blacklist';

describe('Token Blacklist', () => {
  beforeEach(() => {
    // Clear any previous state
    vi.clearAllMocks();
  });

  it('should blacklist a token', async () => {
    const tokenId = 'test-token-123';
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now

    await blacklistToken(tokenId, expiresAt);

    const isBlacklisted = await isTokenBlacklisted(tokenId);
    expect(isBlacklisted).toBe(true);
  });

  it('should not blacklist expired tokens', async () => {
    const tokenId = 'expired-token-456';
    const expiresAt = new Date(Date.now() - 1000); // Already expired

    await blacklistToken(tokenId, expiresAt);

    // Should not be blacklisted because it's already expired
    const isBlacklisted = await isTokenBlacklisted(tokenId);
    expect(isBlacklisted).toBe(false);
  });

  it('should return false for non-blacklisted tokens', async () => {
    const tokenId = 'non-blacklisted-token-789';

    const isBlacklisted = await isTokenBlacklisted(tokenId);
    expect(isBlacklisted).toBe(false);
  });

  it('should handle multiple tokens independently', async () => {
    const token1 = 'token-1';
    const token2 = 'token-2';
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    // Blacklist only token1
    await blacklistToken(token1, expiresAt);

    expect(await isTokenBlacklisted(token1)).toBe(true);
    expect(await isTokenBlacklisted(token2)).toBe(false);
  });
});
