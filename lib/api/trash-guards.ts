import { NextResponse } from 'next/server';
import { apiResponse } from '@/lib/api-utils';

/**
 * Shared guard for the trash routes (restore and permanent delete).
 *
 * All eight of those routes opened with the same three checks: look the record
 * up through the deleted-aware client, 404 if it is not there, and 400 if it is
 * not actually in the trash. They had drifted: two of them answered 401 for a
 * record owned by another user, while the rest folded ownership into the lookup
 * and answered 404.
 *
 * The cascade logic after the guard differs genuinely per model (a group clears
 * memberships, a relationship type clears three kinds of reference, a
 * relationship also handles its inverse), so this deliberately guards the entry
 * conditions and leaves the work to the route.
 */

export type TrashGuardResult<T> =
  | { ok: true; record: T }
  | { ok: false; response: NextResponse };

interface TrashGuardMessages {
  /** Returned with 404 when the record is missing or owned by someone else. */
  notFound: string;
  /** Returned with 400 when the record exists but is not in the trash. */
  notDeleted: string;
}

/**
 * Resolve a record that must exist, belong to the caller, and be soft-deleted.
 *
 * `find` must scope the query to the calling user, so that a record owned by
 * someone else is indistinguishable from one that does not exist. Answering 403
 * instead would confirm the id is real.
 *
 * @example
 * const guard = await requireTrashedRecord(
 *   () => prismaIncludingDeleted.person.findFirst({
 *     where: { id, userId: session.user.id },
 *   }),
 *   { notFound: 'Person not found', notDeleted: 'Person is not deleted' },
 * );
 * if (!guard.ok) return guard.response;
 */
export async function requireTrashedRecord<T extends { deletedAt: Date | null }>(
  find: () => Promise<T | null>,
  messages: TrashGuardMessages
): Promise<TrashGuardResult<T>> {
  const record = await find();

  if (!record) {
    return { ok: false, response: apiResponse.notFound(messages.notFound) };
  }

  if (!record.deletedAt) {
    return { ok: false, response: apiResponse.error(messages.notDeleted) };
  }

  return { ok: true, record };
}
