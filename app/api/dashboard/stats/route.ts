import { prisma } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { getUpcomingEvents } from '@/lib/upcoming-events';

// GET /api/dashboard/stats - Get dashboard statistics and upcoming events
export const GET = withAuth(async (_request, session) => {
  try {
    const [upcomingEvents, peopleCount, groupsCount] = await Promise.all([
      getUpcomingEvents(session.user.id),
      prisma.person.count({
        where: { userId: session.user.id },
      }),
      prisma.group.count({
        where: { userId: session.user.id },
      }),
    ]);

    return apiResponse.ok({ upcomingEvents, peopleCount, groupsCount });
  } catch (error) {
    return handleApiError(error, 'dashboard-stats');
  }
});
