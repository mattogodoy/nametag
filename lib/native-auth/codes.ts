import { prisma } from '@/lib/prisma';
import { generateToken, hashToken } from '@/lib/token-hash';
import { verifyPkce } from './pkce';
import type { DeviceInfo, DevicePlatformValue } from './sessions';

export const CODE_PREFIX = 'ntc_';
export const CODE_TTL_MS = 60 * 1000;

export type ConsumeResult =
  | { status: 'ok'; userId: string; device: DeviceInfo }
  | { status: 'invalid'; reason: 'unknown' | 'expired' | 'verifier' };

export async function issueNativeAuthCode(
  userId: string,
  pending: { codeChallenge: string; device: DeviceInfo },
  now: Date = new Date()
): Promise<string> {
  const code = `${CODE_PREFIX}${generateToken()}`;
  await prisma.nativeAuthCode.create({
    data: {
      userId,
      codeHash: hashToken(code),
      codeChallenge: pending.codeChallenge,
      deviceName: pending.device.name,
      platform: pending.device.platform,
      appVersion: pending.device.appVersion,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });
  return code;
}

/**
 * Single use: any presentation of a real code deletes it before the checks,
 * so a wrong verifier burns the code and two concurrent exchanges cannot both
 * succeed (only the caller whose delete removed the row continues).
 */
export async function consumeNativeAuthCode(
  code: string,
  verifier: string,
  now: Date = new Date()
): Promise<ConsumeResult> {
  if (!code.startsWith(CODE_PREFIX)) {
    return { status: 'invalid', reason: 'unknown' };
  }
  const row = await prisma.nativeAuthCode.findUnique({ where: { codeHash: hashToken(code) } });
  if (!row) {
    return { status: 'invalid', reason: 'unknown' };
  }
  const deleted = await prisma.nativeAuthCode.deleteMany({ where: { id: row.id } });
  if (deleted.count === 0) {
    return { status: 'invalid', reason: 'unknown' };
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return { status: 'invalid', reason: 'expired' };
  }
  if (!verifyPkce(verifier, row.codeChallenge)) {
    return { status: 'invalid', reason: 'verifier' };
  }
  return {
    status: 'ok',
    userId: row.userId,
    device: { name: row.deviceName, platform: row.platform as DevicePlatformValue, appVersion: row.appVersion },
  };
}

export async function deleteExpiredNativeAuthCodes(now: Date): Promise<number> {
  const result = await prisma.nativeAuthCode.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
