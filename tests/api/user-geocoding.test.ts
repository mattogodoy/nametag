import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userUpdate: vi.fn(),
  addressUpdateMany: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    user: { update: mocks.userUpdate },
    personAddress: { updateMany: mocks.addressUpdateMany },
  },
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { PUT } from '../../app/api/user/geocoding/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/user/geocoding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PUT /api/user/geocoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userUpdate.mockResolvedValue({ id: 'user-123', geocodingEnabled: true });
    mocks.addressUpdateMany.mockResolvedValue({ count: 0 });
  });

  it('rejects invalid bodies', async () => {
    const response = await PUT(makeRequest({ geocodingEnabled: 'yes' }));
    expect(response.status).toBe(400);
  });

  it('updates the user preference', async () => {
    mocks.userUpdate.mockResolvedValue({ id: 'user-123', geocodingEnabled: false });

    const response = await PUT(makeRequest({ geocodingEnabled: false }));
    expect(response.status).toBe(200);
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { geocodingEnabled: false },
      select: { id: true, geocodingEnabled: true },
    });
    expect(mocks.addressUpdateMany).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body.user).toEqual({ id: 'user-123', geocodingEnabled: false });
  });

  it('re-queues disabled addresses when turning geocoding on', async () => {
    await PUT(makeRequest({ geocodingEnabled: true }));
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith({
      where: {
        geocodeStatus: 'disabled',
        person: { userId: 'user-123', deletedAt: null },
      },
      data: { geocodeStatus: 'pending' },
    });
  });
});
