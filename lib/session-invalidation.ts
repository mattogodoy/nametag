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
  try {
    if (isRedisConnected()) {
      const redis = getRedis();
      if (redis) {
        const raw = await redis.get(cacheKey(userId));
        if (raw !== null) {
          return { hit: true, value: raw === NEVER ? null : Number(raw) };
        }
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

/**
 * Change the password and sign out everywhere: stamps the cut-off for web
 * JWTs and deletes every native app session, in one transaction.
 */
export async function invalidateUserSessions(
  userId: string,
  passwordHash: string,
  extra: Record<string, null> = {},
  now: Date = new Date()
): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash, sessionsInvalidatedAt: now, ...extra },
    }),
    prisma.deviceSession.deleteMany({ where: { userId } }),
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
 * JWT `iat` is in whole seconds, so compare at second precision: a token
 * issued in the same second as the change (the re-sign-in right after it) is
 * accepted.
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
 * For the NextAuth jwt callback: true when an existing token was issued
 * before the user's last password change and must be rejected.
 */
export async function shouldRejectJwt(token: { id?: unknown; iat?: unknown }): Promise<boolean> {
  if (typeof token.id !== 'string') {
    return false;
  }
  const iat = typeof token.iat === 'number' ? token.iat : undefined;
  return isIssuedBeforeCutoff(iat, await getSessionsInvalidatedAt(token.id));
}
