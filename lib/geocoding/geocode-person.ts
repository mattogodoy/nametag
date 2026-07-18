import type { PersonAddress } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { createModuleLogger } from '@/lib/logger';
import { buildAddressHash, hasGeocodableContent } from './hash';
import { geocodeAddress } from './provider';
import { enqueueGeocodeRequest } from './queue';

const log = createModuleLogger('geocoding');

export type GeocodeOutcome = 'success' | 'failed' | 'pending' | 'skipped';

/**
 * Geocode one address row if it needs it. Uses updateMany for row updates
 * because person edits recreate address rows (deleteMany + create), so the
 * row may vanish mid-flight; updateMany makes that a harmless no-op.
 */
export async function geocodeSingleAddress(address: PersonAddress): Promise<GeocodeOutcome> {
  const hash = buildAddressHash(address);

  if (!hasGeocodableContent(address)) {
    if (address.geocodeStatus !== 'failed') {
      await prisma.personAddress.updateMany({
        where: { id: address.id },
        data: { geocodeStatus: 'failed', geocodedAt: new Date(), geocodeHash: hash },
      });
    }
    return 'skipped';
  }

  const alreadyResolved = address.geocodeStatus === 'success' || address.geocodeStatus === 'failed';
  if (alreadyResolved && address.geocodeHash === hash) {
    return 'skipped';
  }

  const cached = await prisma.geocodeCache.findUnique({ where: { hash } });
  if (cached) {
    await prisma.personAddress.updateMany({
      where: { id: address.id },
      data: {
        latitude: cached.latitude,
        longitude: cached.longitude,
        geocodeStatus: cached.status,
        geocodedAt: new Date(),
        geocodeHash: hash,
      },
    });
    return cached.status === 'success' ? 'success' : 'failed';
  }

  try {
    const result = await enqueueGeocodeRequest(() => geocodeAddress(address));
    const status = result ? 'success' : 'failed';

    await prisma.geocodeCache.upsert({
      where: { hash },
      create: {
        hash,
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
        status,
      },
      update: {
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
        status,
      },
    });

    await prisma.personAddress.updateMany({
      where: { id: address.id },
      data: {
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
        geocodeStatus: status,
        geocodedAt: new Date(),
        geocodeHash: hash,
      },
    });

    return status;
  } catch (error) {
    // Transient failure (network, 5xx). Leave it pending so the cron retries.
    log.warn(
      {
        err: error instanceof Error ? error : new Error(String(error)),
        addressId: address.id,
      },
      'Geocoding attempt failed, leaving address pending'
    );
    await prisma.personAddress.updateMany({
      where: { id: address.id },
      data: { geocodeStatus: 'pending' },
    });
    return 'pending';
  }
}

/**
 * Geocode all addresses of a person. Intended to run in the background after
 * person create/update; never throws for expected conditions.
 */
export async function geocodePersonAddresses(personId: string): Promise<void> {
  if (env.DISABLE_GEOCODING) {
    return;
  }

  const person = await prisma.person.findUnique({
    where: { id: personId, deletedAt: null },
    include: {
      addresses: true,
      user: { select: { geocodingEnabled: true } },
    },
  });
  if (!person) {
    return;
  }

  if (!person.user.geocodingEnabled) {
    await prisma.personAddress.updateMany({
      where: { personId, geocodeStatus: null },
      data: { geocodeStatus: 'disabled' },
    });
    return;
  }

  for (const address of person.addresses) {
    await geocodeSingleAddress(address);
  }
}
