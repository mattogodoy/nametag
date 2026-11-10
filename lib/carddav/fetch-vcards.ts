import type { createDAVClient, DAVAddressBook, DAVVCard } from 'tsdav';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

type DavClient = Awaited<ReturnType<typeof createDAVClient>>;

/**
 * Fetch every vCard of an address book.
 *
 * tsdav's own `fetchVCards` lists the contacts with an addressbook-query that
 * carries a default `prop-filter` on FN. Some servers (mailbox.org, for one)
 * answer that filter with zero matches although the book is full, which looks
 * exactly like an empty address book: no error, nothing to import, and an empty
 * backup. When the default query finds nothing, list the contacts with a plain
 * PROPFIND instead and fetch them by URL, which every CardDAV server supports.
 */
export async function fetchAllVCards(
  client: Pick<DavClient, 'fetchVCards' | 'propfind'>,
  addressBook: DAVAddressBook,
): Promise<DAVVCard[]> {
  const vCards = await client.fetchVCards({ addressBook });
  if (vCards.length > 0) {
    return vCards;
  }

  try {
    const listing = await client.propfind({
      url: addressBook.url,
      props: { 'd:getetag': {} },
      depth: '1',
    });

    const bookPath = new URL(addressBook.url).pathname.replace(/\/+$/, '');
    const objectUrls = listing
      .filter((entry) => entry.ok && entry.href)
      .map((entry) => new URL(entry.href as string, addressBook.url).pathname)
      .filter((path) => !path.endsWith('/') && path !== bookPath);

    if (objectUrls.length === 0) {
      return vCards;
    }

    const fetched = await client.fetchVCards({ addressBook, objectUrls });
    const fallback = { event: 'carddav.fetch.fallback', listed: objectUrls.length, fetched: fetched.length };
    if (fetched.length < objectUrls.length) {
      // Listing found contacts but fetching them did not return all: the same
      // silent "nothing imported" symptom, so it must not stay at info.
      log.warn(fallback, 'Fetching contacts by URL returned fewer contacts than were listed');
    } else {
      log.info(fallback, 'Address book query returned no contacts, fetched them by URL instead');
    }
    return fetched;
  } catch (error) {
    // Keep the old behaviour (empty result) if the fallback itself fails. Some
    // servers reject the listing and a genuinely empty book then lands here on
    // every background sync, so this stays at debug.
    log.debug(
      { err: error instanceof Error ? error : new Error(String(error)) },
      'Fallback listing of address book contacts failed',
    );
    return vCards;
  }
}
