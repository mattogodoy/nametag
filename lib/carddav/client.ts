import { createDAVClient, DAVAddressBook, DAVVCard } from 'tsdav';
import { CardDavConnection } from '@prisma/client';
import { decryptPassword } from './encryption';

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

      const etag = response.headers?.get('etag') || '';
      // Reconstruct the vCard URL the same way tsdav does
      const vcardUrl = new URL(filename, addressBook.raw.url).href;

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

      const etag = response.headers?.get('etag') || vCard.etag;

      return {
        url: vCard.url,
        etag,
        data: newData,
      };
    },

    async deleteVCard(vCard: VCard): Promise<void> {
      const absoluteUrl = resolveUrl(serverUrl, vCard.url);
      await client.deleteVCard({
        vCard: {
          url: absoluteUrl,
          etag: vCard.etag,
          data: '',
        } as DAVVCard,
      });
    },
  };
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
    console.error('CardDAV connection test failed:', error);
    return false;
  }
}
