import { prisma, prismaIncludingDeleted } from '@/lib/prisma';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';
import { apiError } from '@/lib/api-errors';
import { getChangesSince } from '@/lib/sync/changes';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;
const INTEGER = /^\d{1,19}$/;

// GET /api/sync - Changes since a cursor, for native clients' local cache
export const GET = withAuth(async (request, session) => {
  try {
    const url = new URL(request.url);
    const rawCursor = url.searchParams.get('cursor') ?? '';
    const rawLimit = url.searchParams.get('limit');

    if (!INTEGER.test(rawCursor)) {
      return apiError('invalid_query', 'cursor must be a non-negative integer', { param: 'cursor' });
    }
    let limit = DEFAULT_LIMIT;
    if (rawLimit !== null) {
      if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) {
        return apiError('invalid_query', 'limit must be a positive integer', { param: 'limit' });
      }
      limit = Math.min(Number(rawLimit), MAX_LIMIT);
    }

    const cursor = BigInt(rawCursor);
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { syncSeq: true, syncTombstoneFloor: true },
    });
    if (!user) return apiResponse.unauthorized();

    if (cursor > user.syncSeq) {
      return apiError('invalid_query', 'cursor is ahead of this server', { param: 'cursor' });
    }
    // Cursor 0 is a full resync and is always valid.
    if (cursor !== BigInt(0) && cursor < user.syncTombstoneFloor) {
      return apiError('sync_cursor_expired', 'Sync cursor expired; sync again from 0');
    }

    // Reads through the unfiltered client on purpose: soft-deleted rows are
    // part of the change feed.
    const page = await getChangesSince(prismaIncludingDeleted, session.user.id, cursor, limit);
    return apiResponse.ok({ ...page });
  } catch (error) {
    return handleApiError(error, 'sync');
  }
});
