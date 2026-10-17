import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/token-hash';
import { createModuleLogger } from '@/lib/logger';
import {
  ACCESS_TOKEN_PREFIX,
  REFRESH_TOKEN_PREFIX,
  IDLE_TTL_MS,
  REUSE_GRACE_MS,
  LAST_USED_THROTTLE_MS,
  issueTokenPair,
} from './tokens';

const log = createModuleLogger('native-auth');

export type DevicePlatformValue = 'IOS' | 'ANDROID';

export interface DeviceInfo {
  name: string;
  platform: DevicePlatformValue;
  appVersion: string;
}

export interface IssuedSession {
  sessionId: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

export type DeviceAccessResult =
  | { status: 'ok'; userId: string; sessionId: string }
  | { status: 'expired' }
  | { status: 'invalid' };

export type RefreshResult =
  | { status: 'ok'; userId: string; session: IssuedSession }
  | { status: 'expired' };

export interface DeviceSessionSummary {
  id: string;
  name: string;
  platform: DevicePlatformValue;
  appVersion: string;
  lastUsedAt: Date;
  createdAt: Date;
}

interface SessionState {
  id: string;
  userId: string;
  refreshTokenHash: string;
  previousRefreshTokenHash: string | null;
  rotatedAt: Date | null;
  idleExpiresAt: Date;
}

export async function createDeviceSession(
  userId: string,
  device: DeviceInfo,
  now: Date = new Date()
): Promise<IssuedSession> {
  const pair = issueTokenPair(now);
  const row = await prisma.deviceSession.create({
    data: {
      userId,
      name: device.name,
      platform: device.platform,
      appVersion: device.appVersion,
      accessTokenHash: pair.accessTokenHash,
      accessExpiresAt: pair.accessExpiresAt,
      refreshTokenHash: pair.refreshTokenHash,
      idleExpiresAt: new Date(now.getTime() + IDLE_TTL_MS),
    },
  });
  return {
    sessionId: row.id,
    accessToken: pair.accessToken,
    accessTokenExpiresAt: pair.accessExpiresAt,
    refreshToken: pair.refreshToken,
  };
}

export async function resolveDeviceAccessToken(
  token: string,
  now: Date = new Date()
): Promise<DeviceAccessResult> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) {
    return { status: 'invalid' };
  }

  const row = await prisma.deviceSession.findUnique({
    where: { accessTokenHash: hashToken(token) },
  });
  if (!row) {
    return { status: 'invalid' };
  }
  if (row.accessExpiresAt.getTime() <= now.getTime()) {
    return { status: 'expired' };
  }

  if (now.getTime() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    // Fire-and-forget: last-used tracking must not block or fail the request.
    prisma.deviceSession
      .update({ where: { id: row.id }, data: { lastUsedAt: now } })
      .catch((err: unknown) =>
        log.warn(
          { err: err instanceof Error ? err : new Error(String(err)), sessionId: row.id },
          'Failed to update deviceSession.lastUsedAt'
        )
      );
  }

  return { status: 'ok', userId: row.userId, sessionId: row.id };
}

/**
 * Issue a new pair for `state`, but only if its refresh hash is still
 * `state.refreshTokenHash`. Returns null when a concurrent refresh won.
 */
async function rotate(
  state: SessionState,
  previous: { hash: string; rotatedAt: Date },
  now: Date
): Promise<IssuedSession | null> {
  const pair = issueTokenPair(now);
  const result = await prisma.deviceSession.updateMany({
    where: { id: state.id, refreshTokenHash: state.refreshTokenHash },
    data: {
      accessTokenHash: pair.accessTokenHash,
      accessExpiresAt: pair.accessExpiresAt,
      refreshTokenHash: pair.refreshTokenHash,
      previousRefreshTokenHash: previous.hash,
      rotatedAt: previous.rotatedAt,
      idleExpiresAt: new Date(now.getTime() + IDLE_TTL_MS),
      lastUsedAt: now,
    },
  });
  if (result.count === 0) {
    return null;
  }
  return {
    sessionId: state.id,
    accessToken: pair.accessToken,
    accessTokenExpiresAt: pair.accessExpiresAt,
    refreshToken: pair.refreshToken,
  };
}

const EXPIRED: RefreshResult = { status: 'expired' };

export async function refreshDeviceSession(
  refreshToken: string,
  now: Date = new Date(),
  attempt = 0
): Promise<RefreshResult> {
  if (!refreshToken.startsWith(REFRESH_TOKEN_PREFIX)) {
    return EXPIRED;
  }
  const hash = hashToken(refreshToken);

  // Rule 1: the current refresh token.
  const current = await prisma.deviceSession.findUnique({ where: { refreshTokenHash: hash } });
  if (current) {
    if (current.idleExpiresAt.getTime() <= now.getTime()) {
      await prisma.deviceSession.deleteMany({ where: { id: current.id } });
      return EXPIRED;
    }
    const session = await rotate(current, { hash, rotatedAt: now }, now);
    if (session) {
      return { status: 'ok', userId: current.userId, session };
    }
    // Lost a race with a concurrent refresh: re-evaluate once against the new state.
    return attempt === 0 ? refreshDeviceSession(refreshToken, now, 1) : EXPIRED;
  }

  // Rules 2 and 3: the refresh token that was just rotated away.
  const previous = await prisma.deviceSession.findUnique({ where: { previousRefreshTokenHash: hash } });
  if (!previous || !previous.rotatedAt) {
    return EXPIRED; // Rule 4: unknown.
  }
  if (previous.idleExpiresAt.getTime() <= now.getTime()) {
    await prisma.deviceSession.deleteMany({ where: { id: previous.id } });
    return EXPIRED;
  }

  if (now.getTime() - previous.rotatedAt.getTime() <= REUSE_GRACE_MS) {
    // Rule 2: the client most likely never received the last response. Keep the
    // replayed token as "previous" and keep the original rotation time, so the
    // grace window stays 60 seconds from the first rotation.
    const session = await rotate(previous, { hash, rotatedAt: previous.rotatedAt }, now);
    if (session) {
      return { status: 'ok', userId: previous.userId, session };
    }
    return attempt === 0 ? refreshDeviceSession(refreshToken, now, 1) : EXPIRED;
  }

  // Rule 3: an old token came back long after rotation. Treat as theft.
  await prisma.deviceSession.deleteMany({ where: { id: previous.id } });
  log.warn(
    { event: 'auth.native.refresh_reuse', userId: previous.userId, sessionId: previous.id },
    'Refresh token reused after rotation; device session revoked'
  );
  return EXPIRED;
}

export async function listDeviceSessions(userId: string): Promise<DeviceSessionSummary[]> {
  const rows = await prisma.deviceSession.findMany({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
    select: { id: true, name: true, platform: true, appVersion: true, lastUsedAt: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    platform: r.platform as DevicePlatformValue,
    appVersion: r.appVersion,
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
  }));
}

/** Scoped to the owner so one user can never revoke another's device. */
export async function revokeDeviceSession(userId: string, id: string): Promise<boolean> {
  const result = await prisma.deviceSession.deleteMany({ where: { id, userId } });
  return result.count > 0;
}

export async function revokeOtherDeviceSessions(userId: string, keepId: string | null): Promise<number> {
  const result = await prisma.deviceSession.deleteMany({
    where: keepId ? { userId, id: { not: keepId } } : { userId },
  });
  return result.count;
}

export async function deleteIdleDeviceSessions(now: Date): Promise<number> {
  const result = await prisma.deviceSession.deleteMany({ where: { idleExpiresAt: { lt: now } } });
  return result.count;
}
