import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addressFindMany: vi.fn(),
  cronLogCreate: vi.fn(),
  cronLogUpdate: vi.fn(),
  geocodeSingleAddress: vi.fn(),
  envValues: {
    CRON_SECRET: 'test-cron-secret-1234',
    DISABLE_GEOCODING: false,
  },
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    personAddress: { findMany: mocks.addressFindMany },
    cronJobLog: { create: mocks.cronLogCreate, update: mocks.cronLogUpdate },
  },
}));

vi.mock('@/lib/env', () => ({ env: mocks.envValues }));

vi.mock('../../lib/geocoding/geocode-person', () => ({
  geocodeSingleAddress: mocks.geocodeSingleAddress,
}));

import { GET } from '../../app/api/cron/geocode/route';

function makeRequest(secret = 'test-cron-secret-1234'): Request {
  return new Request('http://localhost/api/cron/geocode', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe('GET /api/cron/geocode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.envValues.DISABLE_GEOCODING = false;
    mocks.cronLogCreate.mockResolvedValue({ id: 'log-1' });
    mocks.cronLogUpdate.mockResolvedValue({});
  });

  it('rejects requests without the cron secret', async () => {
    const response = await GET(makeRequest('wrong-secret'));
    expect(response.status).toBe(401);
  });

  it('short-circuits when geocoding is disabled instance-wide', async () => {
    mocks.envValues.DISABLE_GEOCODING = true;
    const response = await GET(makeRequest());
    const body = await response.json();
    expect(body.disabled).toBe(true);
    expect(mocks.addressFindMany).not.toHaveBeenCalled();
  });

  it('processes a batch and reports outcomes', async () => {
    mocks.addressFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }]);
    mocks.geocodeSingleAddress
      .mockResolvedValueOnce('success')
      .mockResolvedValueOnce('failed')
      .mockResolvedValueOnce('pending');

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, processed: 3, geocoded: 1, failed: 1, pending: 1, skipped: 0 });

    // Only addresses of opted-in users and non-deleted people
    expect(mocks.addressFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ geocodeStatus: null }, { geocodeStatus: 'pending' }],
          person: { deletedAt: null, user: { geocodingEnabled: true } },
        },
        take: 50,
      })
    );
    expect(mocks.cronLogUpdate).toHaveBeenCalled();
  });

  it('continues the batch when an address throws unexpectedly, counting it as pending', async () => {
    mocks.addressFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }]);
    mocks.geocodeSingleAddress
      .mockRejectedValueOnce(new Error('unexpected boom'))
      .mockResolvedValueOnce('success');

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, processed: 2, geocoded: 1, failed: 0, pending: 1, skipped: 0 });
    expect(mocks.cronLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed_with_errors' }),
      })
    );
  });
});
