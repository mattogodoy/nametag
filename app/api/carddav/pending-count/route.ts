import { prisma } from '@/lib/prisma';
import { getAlreadyMappedPersonUids } from '@/lib/carddav/mapped-uids';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

export const GET = withAuth(async (_request, session) => {
  try {
    // Get connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return apiResponse.ok({ count: 0 });
    }

    // Exclude pending imports whose person is already mapped (under any UID)
    const alreadyMappedPersonUids = await getAlreadyMappedPersonUids(session.user.id);

    const count = await prisma.cardDavPendingImport.count({
      where: {
        connectionId: connection.id,
        ...(alreadyMappedPersonUids.size > 0
          ? { uid: { notIn: [...alreadyMappedPersonUids] } }
          : {}),
      },
    });

    return apiResponse.ok({ count });
  } catch (error) {
    return handleApiError(error, 'carddav-pending-count');
  }
});
