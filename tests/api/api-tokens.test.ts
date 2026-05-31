import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/api-tokens', () => ({
  createApiToken: vi.fn(),
  listApiTokens: vi.fn(),
  revokeApiToken: vi.fn(),
  // Imported by withAuth; never exercised here since these routes are session-only.
  resolveApiToken: vi.fn(),
}));

import { GET, POST } from '@/app/api/user/api-tokens/route';
import { DELETE } from '@/app/api/user/api-tokens/[id]/route';
import { auth } from '@/lib/auth';
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  resolveApiToken,
} from '@/lib/api-tokens';

function authenticate() {
  vi.mocked(auth).mockResolvedValue({
    user: { id: 'u1', email: 'a@b.c' },
  } as never);
}

describe('/api/user/api-tokens', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET', () => {
    it('lists the current user tokens', async () => {
      authenticate();
      vi.mocked(listApiTokens).mockResolvedValue([{ id: 't1' }] as never);

      const res = await GET(
        new NextRequest('http://localhost/api/user/api-tokens')
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.tokens).toHaveLength(1);
      expect(listApiTokens).toHaveBeenCalledWith('u1');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const res = await GET(
        new NextRequest('http://localhost/api/user/api-tokens')
      );

      expect(res.status).toBe(401);
      expect(listApiTokens).not.toHaveBeenCalled();
    });

    it('does not accept a bearer token (management is session-only)', async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const res = await GET(
        new NextRequest('http://localhost/api/user/api-tokens', {
          headers: { authorization: 'Bearer ntag_x' },
        })
      );

      expect(res.status).toBe(401);
      expect(resolveApiToken).not.toHaveBeenCalled();
    });
  });

  describe('POST', () => {
    it('creates a token and returns the plaintext once', async () => {
      authenticate();
      vi.mocked(createApiToken).mockResolvedValue({
        id: 't1',
        token: 'ntag_secret',
        scope: 'READ_WRITE',
      } as never);

      const res = await POST(
        new NextRequest('http://localhost/api/user/api-tokens', {
          method: 'POST',
          body: JSON.stringify({ name: 'MCP', scope: 'READ_WRITE' }),
          headers: { 'content-type': 'application/json' },
        })
      );
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.apiToken.token).toBe('ntag_secret');
      expect(createApiToken).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', name: 'MCP', scope: 'READ_WRITE' })
      );
    });

    it('rejects an empty name with 400', async () => {
      authenticate();

      const res = await POST(
        new NextRequest('http://localhost/api/user/api-tokens', {
          method: 'POST',
          body: JSON.stringify({ name: '' }),
          headers: { 'content-type': 'application/json' },
        })
      );

      expect(res.status).toBe(400);
      expect(createApiToken).not.toHaveBeenCalled();
    });
  });

  describe('DELETE', () => {
    it('revokes an owned token', async () => {
      authenticate();
      vi.mocked(revokeApiToken).mockResolvedValue(true);

      const res = await DELETE(
        new NextRequest('http://localhost/api/user/api-tokens/t1', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 't1' }) }
      );

      expect(res.status).toBe(200);
      expect(revokeApiToken).toHaveBeenCalledWith('u1', 't1');
    });

    it('returns 404 when the token does not exist', async () => {
      authenticate();
      vi.mocked(revokeApiToken).mockResolvedValue(false);

      const res = await DELETE(
        new NextRequest('http://localhost/api/user/api-tokens/x', {
          method: 'DELETE',
        }),
        { params: Promise.resolve({ id: 'x' }) }
      );

      expect(res.status).toBe(404);
    });
  });
});
