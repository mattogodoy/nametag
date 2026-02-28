import { createDAVClient, DAVAddressBook, DAVVCard } from 'tsdav';
import { CardDavConnection } from '@prisma/client';
import { decryptPassword } from './encryption';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

export interface AddressBook {
  url: string;
  displayName?: string;
  description?: string;
  syncToken?: string;
  raw: DAVAddressBook; // Keep raw for API calls
}

export interface VCard {
  url: string;
  etag: string;
  data: string;
}

export interface CardDavClientInterface {
  fetchAddressBooks(): Promise<AddressBook[]>;
  fetchVCards(addressBook: AddressBook): Promise<VCard[]>;
  createVCard(addressBook: AddressBook, vCardData: string, filename: string): Promise<VCard>;
  updateVCard(vCard: VCard, newData: string): Promise<VCard>;
  deleteVCard(vCard: VCard): Promise<void>;
}

/**
 * Resolve a potentially relative URL against a base server URL.
 */
function resolveUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  // Strip trailing slash from base, ensure path starts with /
  const origin = new URL(base).origin;
  const resolved = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${resolved}`;
}

export async function createCardDavClient(
  connection: CardDavConnection
): Promise<CardDavClientInterface> {
  // Decrypt the password from database
  const password = decryptPassword(connection.password);
  const serverUrl = connection.serverUrl;

  const client = await createDAVClient({
    serverUrl,
    credentials: {
      username: connection.username,
      password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'carddav',
  });

  return {
    async fetchAddressBooks(): Promise<AddressBook[]> {
      const addressBooks = await client.fetchAddressBooks();
      return addressBooks.map((ab: DAVAddressBook) => {
        // Ensure address book URL is absolute for downstream use
        const absoluteUrl = resolveUrl(serverUrl, ab.url);
        const resolvedAb = { ...ab, url: absoluteUrl };
        return {
          url: absoluteUrl,
          displayName: typeof ab.displayName === 'string' ? ab.displayName : undefined,
          description: ab.description,
          syncToken: ab.syncToken,
          raw: resolvedAb,
        };
      });
    },

    async fetchVCards(addressBook: AddressBook): Promise<VCard[]> {
      const vCards = await client.fetchVCards({
        addressBook: addressBook.raw,
      });

      return vCards.map((vc: DAVVCard) => ({
        // Ensure vCard URL is absolute
        url: resolveUrl(serverUrl, vc.url),
        etag: vc.etag || '',
        data: vc.data || '',
      }));
    },

    async createVCard(
      addressBook: AddressBook,
      vCardData: string,
      filename: string
    ): Promise<VCard> {
      // Use tsdav's high-level createVCard which handles auth headers correctly.
      // The address book URL is already absolute from fetchAddressBooks.
      const response = await client.createVCard({
        addressBook: addressBook.raw,
        vCardString: vCardData,
        filename,
      });

      // tsdav uses fetch() which does NOT throw on HTTP errors (4xx/5xx).
      const createRes = response as Response | undefined;
      if (createRes && typeof createRes.ok === 'boolean' && !createRes.ok) {
        const statusText = createRes.statusText || 'Unknown error';
        throw new Error(`CardDAV CREATE failed: ${createRes.status} ${statusText}`);
      }

      const etag = response.headers?.get('etag') || '';

      // Determine the actual URL of the created vCard.
      // Prefer the response URL (actual URL the PUT was sent to, after any redirects)
      // over reconstructing it, since `new URL(filename, base)` silently drops
      // the last path segment when the base URL lacks a trailing slash.
      const createResponse = response as Response | undefined;
      let vcardUrl: string;
      if (createResponse?.url) {
        vcardUrl = createResponse.url;
      } else {
        // Fallback: ensure trailing slash on address book URL for correct resolution
        const abUrl = addressBook.raw.url.endsWith('/')
          ? addressBook.raw.url
          : addressBook.raw.url + '/';
        vcardUrl = new URL(filename, abUrl).href;
      }

      return {
        url: vcardUrl,
        etag,
        data: vCardData,
      };
    },

    async updateVCard(vCard: VCard, newData: string): Promise<VCard> {
      // Use tsdav's high-level updateVCard which handles auth headers correctly.
      const absoluteUrl = resolveUrl(serverUrl, vCard.url);
      const response = await client.updateVCard({
        vCard: {
          url: absoluteUrl,
          etag: vCard.etag,
          data: newData,
        } as DAVVCard,
      });

      // tsdav uses fetch() which does NOT throw on HTTP errors (4xx/5xx).
      const updateRes = response as Response | undefined;
      if (updateRes && typeof updateRes.ok === 'boolean' && !updateRes.ok) {
        const statusText = updateRes.statusText || 'Unknown error';
        throw new Error(`CardDAV UPDATE failed: ${updateRes.status} ${statusText}`);
      }

      const etag = response.headers?.get('etag') || vCard.etag;

      return {
        url: vCard.url,
        etag,
        data: newData,
      };
    },

    async deleteVCard(vCard: VCard): Promise<void> {
      const absoluteUrl = resolveUrl(serverUrl, vCard.url);
      const response = await client.deleteVCard({
        vCard: {
          url: absoluteUrl,
          etag: vCard.etag,
          data: '',
        } as DAVVCard,
      });

      // tsdav uses fetch() which does NOT throw on HTTP errors (4xx/5xx).
      // We must check the response status ourselves.
      const res = response as Response | undefined;
      if (res && typeof res.ok === 'boolean' && !res.ok) {
        const statusText = res.statusText || 'Unknown error';
        throw new Error(`CardDAV DELETE failed: ${res.status} ${statusText}`);
      }
    },
  };
}

/**
 * Delete a vCard by direct HTTP DELETE request, bypassing tsdav's full DAV discovery.
 * Use this when you already know the vCard URL and just need to delete it.
 * This avoids the fragile discovery step that can fail with "cannot find homeUrl".
 */
export async function deleteVCardDirect(
  connection: CardDavConnection,
  vCardUrl: string,
  etag: string
): Promise<void> {
  const password = decryptPassword(connection.password);
  const authHeader = 'Basic ' + Buffer.from(`${connection.username}:${password}`).toString('base64');

  const absoluteUrl = resolveUrl(connection.serverUrl, vCardUrl);

  const headers: Record<string, string> = {
    Authorization: authHeader,
  };
  if (etag && etag !== '*') {
    headers['If-Match'] = etag;
  } else if (etag === '*') {
    headers['If-Match'] = '*';
  }

  const response = await fetch(absoluteUrl, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error(`CardDAV DELETE failed: ${response.status} ${response.statusText || 'Unknown error'}`);
  }
}

/**
 * Test a CardDAV connection without creating a full client
 */
export async function testCardDavConnection(
  serverUrl: string,
  username: string,
  password: string
): Promise<boolean> {
  try {
    const client = await createDAVClient({
      serverUrl,
      credentials: {
        username,
        password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'carddav',
    });

    // Try to fetch address books to verify connection
    await client.fetchAddressBooks();
    return true;
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'CardDAV connection test failed');
    return false;
  }
}
