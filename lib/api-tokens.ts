import { prisma } from './prisma';
import { generateToken, hashToken } from './token-hash';
import { createModuleLogger } from './logger';

const log = createModuleLogger('api-tokens');

/** Human-recognizable prefix for Nametag API tokens. */
export const API_TOKEN_PREFIX = 'ntag_';

/** Number of leading characters stored/displayed for token recognition. */
const PREFIX_DISPLAY_LENGTH = 12;

export type ApiTokenScopeValue = 'READ' | 'READ_WRITE';

interface CreateApiTokenParams {
  userId: string;
  name: string;
  scope?: ApiTokenScopeValue;
  expiresAt?: Date | null;
}

export interface CreatedApiToken {
  id: string;
  name: string;
  scope: ApiTokenScopeValue;
  prefix: string;
  expiresAt: Date | null;
  createdAt: Date;
  /** Plaintext token. Returned ONCE on creation, never retrievable again. */
  token: string;
}

/**
 * Create a new API token for a user.
 * Generates a cryptographically random plaintext token, stores only its
 * SHA-256 hash, and returns the plaintext exactly once for the caller to copy.
 */
export async function createApiToken({
  userId,
  name,
  scope = 'READ_WRITE',
  expiresAt = null,
}: CreateApiTokenParams): Promise<CreatedApiToken> {
  const plaintext = `${API_TOKEN_PREFIX}${generateToken()}`;
  const tokenHash = hashToken(plaintext);
  const prefix = plaintext.slice(0, PREFIX_DISPLAY_LENGTH);

  const created = await prisma.apiToken.create({
    data: { userId, name, tokenHash, prefix, scope, expiresAt },
  });

  return {
    id: created.id,
    name: created.name,
    scope: created.scope as ApiTokenScopeValue,
    prefix: created.prefix,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
    token: plaintext,
  };
}

export interface ResolvedApiToken {
  userId: string;
  scope: ApiTokenScopeValue;
  tokenId: string;
}

/**
 * Resolve a plaintext bearer token to its owner and scope.
 * Returns null for unknown, malformed, or expired tokens.
 * Updates lastUsedAt in the background (non-blocking).
 */
export async function resolveApiToken(
  plaintext: string
): Promise<ResolvedApiToken | null> {
  if (!plaintext.startsWith(API_TOKEN_PREFIX)) {
    return null;
  }

  const tokenHash = hashToken(plaintext);
  const token = await prisma.apiToken.findUnique({ where: { tokenHash } });

  if (!token) {
    return null;
  }

  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
    return null;
  }

  // Fire-and-forget last-used tracking: must not block or fail the request.
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch((err: unknown) =>
      log.warn(
        {
          err: err instanceof Error ? err : new Error(String(err)),
          tokenId: token.id,
        },
        'Failed to update apiToken.lastUsedAt'
      )
    );

  return {
    userId: token.userId,
    scope: token.scope as ApiTokenScopeValue,
    tokenId: token.id,
  };
}

/** List a user's tokens for display. Never returns the hash or plaintext. */
export async function listApiTokens(userId: string) {
  return prisma.apiToken.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      prefix: true,
      scope: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });
}

/**
 * Revoke (delete) a token. Scoped to the owning user so one user can never
 * revoke another's token. Returns true if a token was deleted.
 */
export async function revokeApiToken(
  userId: string,
  id: string
): Promise<boolean> {
  const result = await prisma.apiToken.deleteMany({ where: { id, userId } });
  return result.count > 0;
}
