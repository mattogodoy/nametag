import { prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { apiError } from '@/lib/api-errors';
import { getChangesSince, parseSyncCursor } from '@/lib/sync/changes';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

// GET /api/sync - Changes since a cursor, for native clients' local cache
export const GET = withAuth(async (request, session) => {
  try {
    const url = new URL(request.url);
    const rawCursor = url.searchParams.get('cursor') ?? '';
    const rawLimit = url.searchParams.get('limit');

    const cursor = parseSyncCursor(rawCursor);
    if (!cursor) {
      return apiError('invalid_query', 'cursor must be a cursor returned by this endpoint, or 0', { param: 'cursor' });
    }
    let limit = DEFAULT_LIMIT;
    if (rawLimit !== null) {
      if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) {
        return apiError('invalid_query', 'limit must be a positive integer', { param: 'limit' });
      }
      limit = Math.min(Number(rawLimit), MAX_LIMIT);
    }

    // Reads through the unfiltered client on purpose: soft-deleted rows are
    // part of the change feed.
    // The cursor checks run inside the same snapshot as the reads.
    const result = await getChangesSince(prismaIncludingDeleted, session.user.id, cursor, limit);
    switch (result.status) {
      case 'no_user':
        return apiResponse.unauthorized();
      case 'ahead':
        return apiError('invalid_query', 'cursor is ahead of this server', { param: 'cursor' });
      case 'expired':
        return apiError('sync_cursor_expired', 'Sync cursor expired; sync again from 0');
      case 'ok':
        return apiResponse.ok({ ...result.page });
    }
  } catch (error) {
    return handleApiError(error, 'sync');
  }
});
