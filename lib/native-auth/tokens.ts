import { generateToken, hashToken } from '@/lib/token-hash';

/** Prefix of native app access tokens, sent as `Authorization: Bearer`. */
export const ACCESS_TOKEN_PREFIX = 'ntsa_';
/** Prefix of native app refresh tokens, only ever sent to the refresh endpoint. */
export const REFRESH_TOKEN_PREFIX = 'ntsr_';

export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** How long a just-rotated refresh token may be replayed (lost response on a flaky network). */
export const REUSE_GRACE_MS = 60 * 1000;
export const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

export interface TokenPair {
  accessToken: string;
  accessTokenHash: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshTokenHash: string;
}

export function issueTokenPair(now: Date): TokenPair {
  const accessToken = `${ACCESS_TOKEN_PREFIX}${generateToken()}`;
  const refreshToken = `${REFRESH_TOKEN_PREFIX}${generateToken()}`;
  return {
    accessToken,
    accessTokenHash: hashToken(accessToken),
    accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    refreshToken,
    refreshTokenHash: hashToken(refreshToken),
  };
}
