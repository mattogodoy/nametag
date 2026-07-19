import { prisma } from '@/lib/prisma';
import { updateGeocodingSchema, validateRequest } from '@/lib/validations';
import { apiResponse, handleApiError, parseRequestBody, withAuth } from '@/lib/api-utils';

export const PUT = withAuth(async (request, session) => {
  try {
    const body = await parseRequestBody(request);
    const validation = validateRequest(updateGeocodingSchema, body);

    if (!validation.success) {
      return validation.response;
    }

    const { geocodingEnabled } = validation.data;
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { geocodingEnabled },
    });

    if (geocodingEnabled) {
      // Re-queue addresses that were skipped while the toggle was off;
      // the geocode cron picks them up on its next run.
      await prisma.personAddress.updateMany({
        where: {
          geocodeStatus: 'disabled',
          person: { userId: session.user.id, deletedAt: null },
        },
        data: { geocodeStatus: 'pending' },
      });
    }

    return apiResponse.ok({ user });
  } catch (error) {
    return handleApiError(error, 'user-geocoding-update');
  }
});
