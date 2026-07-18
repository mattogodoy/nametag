import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  personFindUnique: vi.fn(),
  addressUpdateMany: vi.fn(),
  cacheFindUnique: vi.fn(),
  cacheUpsert: vi.fn(),
  geocodeAddress: vi.fn(),
}));

const envValues = vi.hoisted(() => ({
  DISABLE_GEOCODING: false,
  GEOCODER_URL: 'https://geocoder.test',
}));

vi.mock('../../lib/prisma', () => ({
  prisma: {
    person: { findUnique: mocks.personFindUnique },
    personAddress: { updateMany: mocks.addressUpdateMany },
    geocodeCache: { findUnique: mocks.cacheFindUnique, upsert: mocks.cacheUpsert },
  },
}));

vi.mock('@/lib/env', () => ({
  env: envValues,
}));

vi.mock('../../lib/geocoding/provider', () => ({
  geocodeAddress: mocks.geocodeAddress,
  GeocodingProviderError: class GeocodingProviderError extends Error {},
}));

// Run queue tasks immediately in tests
vi.mock('../../lib/geocoding/queue', () => ({
  enqueueGeocodeRequest: <T>(task: () => Promise<T>) => task(),
}));

import { geocodeSingleAddress, geocodePersonAddresses } from '../../lib/geocoding/geocode-person';
import { buildAddressHash } from '../../lib/geocoding/hash';
import type { PersonAddress } from '@prisma/client';

function makeAddress(overrides: Partial<PersonAddress> = {}): PersonAddress {
  return {
    id: 'addr-1',
    personId: 'person-1',
    type: 'home',
    streetLine1: '123 Main St',
    streetLine2: null,
    locality: 'Springfield',
    region: 'IL',
    postalCode: '62701',
    country: 'US',
    latitude: null,
    longitude: null,
    geocodedAt: null,
    geocodeStatus: null,
    geocodeHash: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as PersonAddress;
}

describe('geocodeSingleAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addressUpdateMany.mockResolvedValue({ count: 1 });
    mocks.cacheUpsert.mockResolvedValue({});
  });

  it('marks empty addresses failed without calling the provider', async () => {
    const address = makeAddress({ streetLine1: null, locality: null, region: null, postalCode: null, country: null });
    const outcome = await geocodeSingleAddress(address);
    expect(outcome).toBe('skipped');
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'addr-1' },
        data: expect.objectContaining({ geocodeStatus: 'failed' }),
      })
    );
  });

  it('skips addresses whose hash is unchanged since last attempt', async () => {
    const address = makeAddress();
    const upToDate = makeAddress({ geocodeStatus: 'success', geocodeHash: buildAddressHash(address) });
    const outcome = await geocodeSingleAddress(upToDate);
    expect(outcome).toBe('skipped');
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.cacheFindUnique).not.toHaveBeenCalled();
  });

  it('resolves from the cache without calling the provider', async () => {
    mocks.cacheFindUnique.mockResolvedValue({ hash: 'x', latitude: 1.5, longitude: 2.5, status: 'success' });
    const outcome = await geocodeSingleAddress(makeAddress());
    expect(outcome).toBe('success');
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'addr-1' },
        data: expect.objectContaining({ latitude: 1.5, longitude: 2.5, geocodeStatus: 'success' }),
      })
    );
  });

  it('calls the provider, stores the result and caches it', async () => {
    mocks.cacheFindUnique.mockResolvedValue(null);
    mocks.geocodeAddress.mockResolvedValue({ latitude: 39.78, longitude: -89.65 });

    const outcome = await geocodeSingleAddress(makeAddress());

    expect(outcome).toBe('success');
    expect(mocks.cacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hash: buildAddressHash(makeAddress()) },
        create: expect.objectContaining({ latitude: 39.78, longitude: -89.65, status: 'success' }),
      })
    );
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ latitude: 39.78, longitude: -89.65, geocodeStatus: 'success' }),
      })
    );
  });

  it('records failed when the provider finds nothing, and caches the failure', async () => {
    mocks.cacheFindUnique.mockResolvedValue(null);
    mocks.geocodeAddress.mockResolvedValue(null);

    const outcome = await geocodeSingleAddress(makeAddress());

    expect(outcome).toBe('failed');
    expect(mocks.cacheUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ status: 'failed' }) })
    );
  });

  it('leaves the address pending on transient provider errors', async () => {
    mocks.cacheFindUnique.mockResolvedValue(null);
    mocks.geocodeAddress.mockRejectedValue(new Error('network down'));

    const outcome = await geocodeSingleAddress(makeAddress());

    expect(outcome).toBe('pending');
    expect(mocks.cacheUpsert).not.toHaveBeenCalled();
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { geocodeStatus: 'pending' } })
    );
  });
});

describe('geocodePersonAddresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addressUpdateMany.mockResolvedValue({ count: 1 });
    envValues.DISABLE_GEOCODING = false;
  });

  afterEach(() => {
    envValues.DISABLE_GEOCODING = false;
  });

  it('does nothing when the instance-wide kill switch is enabled', async () => {
    envValues.DISABLE_GEOCODING = true;

    await geocodePersonAddresses('person-1');

    expect(mocks.personFindUnique).not.toHaveBeenCalled();
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
  });

  it('does nothing for missing or soft-deleted people', async () => {
    mocks.personFindUnique.mockResolvedValue(null);
    await geocodePersonAddresses('person-1');
    expect(mocks.personFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'person-1', deletedAt: null } })
    );
    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
  });

  it('marks addresses disabled when the user opted out', async () => {
    mocks.personFindUnique.mockResolvedValue({
      id: 'person-1',
      addresses: [makeAddress()],
      user: { geocodingEnabled: false },
    });

    await geocodePersonAddresses('person-1');

    expect(mocks.geocodeAddress).not.toHaveBeenCalled();
    expect(mocks.addressUpdateMany).toHaveBeenCalledWith({
      where: { personId: 'person-1', geocodeStatus: null },
      data: { geocodeStatus: 'disabled' },
    });
  });

  it('geocodes every address for an opted-in user', async () => {
    mocks.personFindUnique.mockResolvedValue({
      id: 'person-1',
      addresses: [makeAddress(), makeAddress({ id: 'addr-2', locality: 'Shelbyville' })],
      user: { geocodingEnabled: true },
    });
    mocks.cacheFindUnique.mockResolvedValue(null);
    mocks.geocodeAddress.mockResolvedValue({ latitude: 1, longitude: 2 });

    await geocodePersonAddresses('person-1');

    expect(mocks.geocodeAddress).toHaveBeenCalledTimes(2);
  });
});
