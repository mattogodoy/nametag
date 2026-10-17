import { prisma } from '@/lib/prisma';
import { getRedis, isRedisConnected } from '@/lib/redis';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('auth');

const CACHE_TTL_MS = 60 * 1000;
const NEVER = 'never';

// In-memory fallback when Redis is not available. Value: cut-off ms or null.
const memoryCache = new Map<string, { value: number | null; expiresAt: number }>();

function cacheKey(userId: string): string {
  return `sessions-invalidated:${userId}`;
}

async function writeCache(userId: string, value: number | null): Promise<void> {
  memoryCache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  try {
    if (isRedisConnected()) {
      const redis = getRedis();
      if (redis) {
        await redis.set(cacheKey(userId), value === null ? NEVER : String(value), 'PX', CACHE_TTL_MS);
      }
    }
  } catch (error) {
    log.warn({ err: error as Error, userId }, 'Failed to cache sessionsInvalidatedAt');
  }
}

async function readCache(userId: string): Promise<{ hit: boolean; value: number | null }> {
  // Redis is the shared source of truth when available: a miss there means
  // "read the database", since local memory can be staler than the database.
  // Memory is only used when Redis is unavailable or its call throws.
  try {
    if (isRedisConnected()) {
      const redis = getRedis();
      if (redis) {
        const raw = await redis.get(cacheKey(userId));
        if (raw === null) {
          return { hit: false, value: null };
        }
        return { hit: true, value: raw === NEVER ? null : Number(raw) };
      }
    }
  } catch (error) {
    log.warn({ err: error as Error, userId }, 'Failed to read cached sessionsInvalidatedAt');
  }
  const entry = memoryCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) {
    return { hit: true, value: entry.value };
  }
  return { hit: false, value: null };
}

export interface InvalidateUserSessionsOptions {
  /** Extra user columns to set in the same update (e.g. clearing reset fields). */
  extra?: Record<string, null>;
  /** A device session to keep signed in (the app that made the change). */
  keepDeviceSessionId?: string;
  now?: Date;
}

/**
 * Change the password and sign out everywhere: stamps the cut-off for web
 * JWTs and deletes every native app session (except `keepDeviceSessionId`),
 * in one transaction.
 */
export async function invalidateUserSessions(
  userId: string,
  passwordHash: string,
  options: InvalidateUserSessionsOptions = {}
): Promise<void> {
  const { extra = {}, keepDeviceSessionId, now = new Date() } = options;
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash, sessionsInvalidatedAt: now, ...extra },
    }),
    prisma.deviceSession.deleteMany({
      where: keepDeviceSessionId ? { userId, id: { not: keepDeviceSessionId } } : { userId },
    }),
  ]);
  await writeCache(userId, now.getTime());
  log.info({ event: 'auth.sessions_invalidated', userId }, 'All sessions invalidated after password change');
}

export async function getSessionsInvalidatedAt(userId: string): Promise<Date | null> {
  const cached = await readCache(userId);
  if (cached.hit) {
    return cached.value === null ? null : new Date(cached.value);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionsInvalidatedAt: true },
  });
  const value = user?.sessionsInvalidatedAt?.getTime() ?? null;
  await writeCache(userId, value);
  return value === null ? null : new Date(value);
}

/**
 * Receives the token's sign-in time in whole seconds (the `authTime` claim,
 * or `iat` for legacy tokens). Compared at second precision: a sign-in in the
 * same second as the change (the re-sign-in right after it) is accepted.
 */
export function isIssuedBeforeCutoff(iat: number | undefined, cutoff: Date | null): boolean {
  if (cutoff === null) {
    return false;
  }
  if (iat === undefined) {
    return true;
  }
  return iat < Math.floor(cutoff.getTime() / 1000);
}

export function __resetSessionInvalidationCacheForTests(): void {
  memoryCache.clear();
}

/**
 * For the NextAuth jwt callback: true when an existing token was signed in
 * before the user's last password change and must be rejected. Uses the
 * stable `authTime` claim, because NextAuth re-encodes the JWT with a fresh
 * `iat` on refresh; falls back to `iat` for legacy tokens without it.
 * Fails open (with a warning) if the cut-off cannot be read.
 */
export async function shouldRejectJwt(token: {
  id?: unknown;
  iat?: unknown;
  authTime?: unknown;
}): Promise<boolean> {
  if (typeof token.id !== 'string') {
    return false;
  }
  const signedInAt =
    typeof token.authTime === 'number'
      ? token.authTime
      : typeof token.iat === 'number'
        ? token.iat
        : undefined;
  try {
    return isIssuedBeforeCutoff(signedInAt, await getSessionsInvalidatedAt(token.id));
  } catch (error) {
    log.warn(
      { err: error as Error, event: 'auth.sessions_invalidated_check_failed', userId: token.id },
      'Could not check the session cut-off, allowing the token'
    );
    return false;
  }
}
