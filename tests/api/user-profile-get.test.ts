import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { GET } from '../../app/api/user/profile/route';

describe('GET /api/user/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the authenticated user profile', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test',
      surname: 'User',
      nickname: null,
      theme: 'LIGHT',
      dateFormat: 'MDY',
      language: 'en',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mocks.userFindUnique.mockResolvedValue(mockUser);

    const request = new Request('http://localhost/api/user/profile');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toEqual(mockUser);
  });

  it('should query by the session user ID', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-123', name: 'Test' });

    const request = new Request('http://localhost/api/user/profile');
    await GET(request);

    expect(mocks.userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-123' },
      })
    );
  });

  it('should only select necessary fields (no password)', async () => {
    mocks.userFindUnique.mockResolvedValue({ id: 'user-123', name: 'Test' });

    const request = new Request('http://localhost/api/user/profile');
    await GET(request);

    const callArg = mocks.userFindUnique.mock.calls[0][0];
    expect(callArg.select).toBeDefined();
    expect(callArg.select).not.toHaveProperty('password');
    expect(callArg.select).not.toHaveProperty('emailVerifyToken');
    expect(callArg.select.id).toBe(true);
    expect(callArg.select.email).toBe(true);
    expect(callArg.select.name).toBe(true);
    expect(callArg.select.theme).toBe(true);
  });

  it('should return 404 if user not found', async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/user/profile');
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('not found');
  });
});
