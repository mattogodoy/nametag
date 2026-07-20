import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addressFindFirst: vi.fn(),
  addressUpdateMany: vi.fn(),
  cacheDeleteMany: vi.fn(),
  userFindUnique: vi.fn(),
  geocodeSingleAddress: vi.fn(),
  envValues: {
    DISABLE_GEOCODING: false,
  },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    personAddress: { findFirst: mocks.addressFindFirst, updateMany: mocks.addressUpdateMany },
    geocodeCache: { deleteMany: mocks.cacheDeleteMany },
    user: { findUnique: mocks.userFindUnique },
  },
}));

vi.mock('@/lib/env', () => ({ env: mocks.envValues }));

vi.mock('../../lib/geocoding/geocode-person', () => ({
  geocodeSingleAddress: mocks.geocodeSingleAddress,
}));

vi.mock('../../lib/auth', () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: 'user-123', email: 'test@example.com', name: 'Test' },
    })
  ),
}));

import { POST } from '../../app/api/map/geocode-retry/route';

const address = {
  id: 'addr-1',
  personId: 'person-1',
  type: 'home',
  streetLine1: 'Plaza Mayor 1',
  streetLine2: null,
  locality: 'Madrid',
  region: null,
  postalCode: null,
  country: 'ES',
  latitude: null,
  longitude: null,
  geocodedAt: null,
  geocodeStatus: 'failed',
  geocodeHash: 'stale-hash',
  createdAt: new Date('2026-01-01'),
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/map/geocode-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/map/geocode-retry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.envValues.DISABLE_GEOCODING = false;
    mocks.addressFindFirst.mockResolvedValue(address);
    mocks.addressUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cacheDeleteMany.mockResolvedValue({ count: 1 });
    mocks.userFindUnique.mockResolvedValue({ geocodingEnabled: true });
    mocks.geocodeSingleAddress.mockResolvedValue('success');
  });

  it('rejects invalid bodies', async () => {
    const response = await POST(makeRequest({ addressId: 42 }));
    expect(response.status).toBe(400);
  });

  it('rejects when geocoding is disabled instance-wide', async () => {
    mocks.envValues.DISABLE_GEOCODING = true;
    const response = await POST(makeRequest({ addressId: 'addr-1' }));
    expect(response.status).toBe(400);
    expect(mocks.geocodeSingleAddress).not.toHaveBeenCalled();
  });

  it('rejects when the user has geocoding disabled', async () => {
    mocks.userFindUnique.mockResolvedValue({ geocodingEnabled: false });
    const response = await POST(makeRequest({ addressId: 'addr-1' }));
    expect(response.status).toBe(400);
    expect(mocks.geocodeSingleAddress).not.toHaveBeenCalled();
  });

  it('returns 404 for addresses outside the tenant', async () => {
    mocks.addressFindFirst.mockResolvedValue(null);
    const response = await POST(makeRequest({ addressId: 'addr-1' }));
    expect(response.status).toBe(404);
    expect(mocks.addressFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'addr-1',
          person: { userId: 'user-123', deletedAt: null },
        },
      })
    );
  });

  it('clears the cached result and the stored hash before retrying', async () => {
    const response = await POST(makeRequest({ addressId: 'addr-1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.outcome).toBe('success');
    expect(mocks.cacheDeleteMany).toHaveBeenCalledWith({
      where: { hash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith({
      where: { id: 'addr-1' },
      data: { geocodeStatus: 'pending', geocodeHash: null },
    });
    expect(mocks.geocodeSingleAddress).toHaveBeenCalledTimes(1);
  });

  it('reports a still-failing lookup', async () => {
    mocks.geocodeSingleAddress.mockResolvedValue('failed');
    const response = await POST(makeRequest({ addressId: 'addr-1' }));
    const body = await response.json();
    expect(body.outcome).toBe('failed');
  });
});
