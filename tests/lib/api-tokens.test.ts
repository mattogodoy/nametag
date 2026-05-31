import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  apiToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  createApiToken,
  resolveApiToken,
  listApiTokens,
  revokeApiToken,
  API_TOKEN_PREFIX,
} from '@/lib/api-tokens';
import { hashToken } from '@/lib/token-hash';

describe('api-tokens service', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createApiToken', () => {
    it('generates a prefixed plaintext token and stores only its hash', async () => {
      mockPrisma.apiToken.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'tok1',
          name: data.name,
          prefix: data.prefix,
          scope: data.scope,
          expiresAt: data.expiresAt,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        })
      );

      const result = await createApiToken({ userId: 'u1', name: 'MCP server' });

      expect(result.token.startsWith(API_TOKEN_PREFIX)).toBe(true);
      expect(result.scope).toBe('READ_WRITE');
      expect(result.prefix).toBe(result.token.slice(0, 12));

      const stored = mockPrisma.apiToken.create.mock.calls[0][0].data;
      // Only the hash is persisted — never the plaintext.
      expect(stored.tokenHash).toBe(hashToken(result.token));
      expect(stored.tokenHash).not.toBe(result.token);
      expect(stored.userId).toBe('u1');
    });
  });

  describe('resolveApiToken', () => {
    it('returns null for tokens without the expected prefix', async () => {
      expect(await resolveApiToken('garbage')).toBeNull();
      expect(mockPrisma.apiToken.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when the token is unknown', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue(null);
      expect(await resolveApiToken(`${API_TOKEN_PREFIX}abc`)).toBeNull();
    });

    it('returns null for an expired token', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: 't',
        userId: 'u1',
        scope: 'READ_WRITE',
        expiresAt: new Date(Date.now() - 1000),
      });
      expect(await resolveApiToken(`${API_TOKEN_PREFIX}abc`)).toBeNull();
    });

    it('resolves a valid token and records last use', async () => {
      mockPrisma.apiToken.findUnique.mockResolvedValue({
        id: 't',
        userId: 'u1',
        scope: 'READ',
        expiresAt: null,
      });
      mockPrisma.apiToken.update.mockResolvedValue({});

      const resolved = await resolveApiToken(`${API_TOKEN_PREFIX}abc`);

      expect(resolved).toEqual({ userId: 'u1', scope: 'READ', tokenId: 't' });
      expect(mockPrisma.apiToken.update).toHaveBeenCalledWith({
        where: { id: 't' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeApiToken', () => {
    it('scopes deletion to the owner and reports success', async () => {
      mockPrisma.apiToken.deleteMany.mockResolvedValue({ count: 1 });
      expect(await revokeApiToken('u1', 't1')).toBe(true);
      expect(mockPrisma.apiToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 't1', userId: 'u1' },
      });
    });

    it('returns false when nothing was deleted', async () => {
      mockPrisma.apiToken.deleteMany.mockResolvedValue({ count: 0 });
      expect(await revokeApiToken('u1', 'nope')).toBe(false);
    });
  });

  describe('listApiTokens', () => {
    it('queries the user tokens without secret fields', async () => {
      mockPrisma.apiToken.findMany.mockResolvedValue([]);
      await listApiTokens('u1');

      const arg = mockPrisma.apiToken.findMany.mock.calls[0][0];
      expect(arg.where).toEqual({ userId: 'u1' });
      expect(arg.select.tokenHash).toBeUndefined();
    });
  });
});
