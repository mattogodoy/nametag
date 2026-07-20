import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { retryGeocodeSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';
import { buildAddressHash } from '@/lib/geocoding/hash';
import { geocodeSingleAddress } from '@/lib/geocoding/geocode-person';

export const POST = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(retryGeocodeSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    if (env.DISABLE_GEOCODING) {
      return apiResponse.error('Geocoding is disabled on this instance');
    }

    const { addressId } = validation.data;

    const address = await prisma.personAddress.findFirst({
      where: {
        id: addressId,
        person: { userId: session.user.id, deletedAt: null },
      },
    });
    if (!address) {
      return apiResponse.notFound('Address not found');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { geocodingEnabled: true },
    });
    if (!user?.geocodingEnabled) {
      return apiResponse.error('Geocoding is disabled in your settings');
    }

    // A manual retry means the user believes the address should resolve, so
    // drop the cached negative result and the stored hash to force a fresh
    // provider lookup instead of replaying the cache.
    const hash = buildAddressHash(address);
    await prisma.geocodeCache.deleteMany({ where: { hash } });
    await prisma.personAddress.updateMany({
      where: { id: addressId },
      data: { geocodeStatus: 'pending', geocodeHash: null },
    });

    const fresh = await prisma.personAddress.findFirst({ where: { id: addressId } });
    if (!fresh) {
      return apiResponse.notFound('Address not found');
    }

    const outcome = await geocodeSingleAddress(fresh);

    return apiResponse.ok({ outcome });
  } catch (error) {
    return handleApiError(error, 'map-geocode-retry');
  }
});
