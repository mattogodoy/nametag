import type { AddressBook, CardDavClientInterface } from './client';

/**
 * Classification of an updateVCard failure, derived by re-fetching the
 * resource and comparing what the server returns to our stored state.
 *
 * - `gone`         : server says the resource doesn't exist (e.g., user
 *                    deleted the contact in Google Contacts). Caller should
 *                    drop the local mapping so the next push runs as CREATE.
 * - `stale-etag`   : the resource exists but its etag has moved on. Some
 *                    servers (notably Google's `carddav/v1`) return 400
 *                    INVALID_ARGUMENT instead of the spec-correct 412 in
 *                    this case. Caller can retry the update with the fresh
 *                    etag.
 * - `unrecoverable`: the resource is present with the same etag we sent
 *                    (i.e. the body itself was rejected), or the recovery
 *                    GET failed. Caller should surface the original error.
 */
export type UpdateRecoveryResult =
  | { kind: 'gone' }
  | { kind: 'stale-etag'; freshEtag: string }
  | { kind: 'unrecoverable' };

export async function classifyUpdateFailure(
  client: CardDavClientInterface,
  addressBook: AddressBook,
  href: string,
  staleEtag: string,
): Promise<UpdateRecoveryResult> {
  let fresh;
  try {
    fresh = await client.fetchVCard(addressBook, href);
  } catch {
    return { kind: 'unrecoverable' };
  }

  if (!fresh) {
    return { kind: 'gone' };
  }

  if (fresh.etag !== staleEtag) {
    return { kind: 'stale-etag', freshEtag: fresh.etag };
  }

  return { kind: 'unrecoverable' };
}
