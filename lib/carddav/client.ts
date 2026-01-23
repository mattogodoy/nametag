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
 * Create a CardDAV client for a given connection
 */
export async function createCardDavClient(
  connection: CardDavConnection
): Promise<CardDavClientInterface> {
  // Decrypt the password from database
  const password = decryptPassword(connection.password);

  const client = await createDAVClient({
    serverUrl: connection.serverUrl,
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
      return addressBooks.map((ab: DAVAddressBook) => ({
        url: ab.url,
        displayName: typeof ab.displayName === 'string' ? ab.displayName : undefined,
        description: ab.description,
        syncToken: ab.syncToken,
        raw: ab,
      }));
    },

    async fetchVCards(addressBook: AddressBook): Promise<VCard[]> {
      const vCards = await client.fetchVCards({
        addressBook: addressBook.raw,
      });

      return vCards.map((vc: DAVVCard) => ({
        url: vc.url,
        etag: vc.etag || '',
        data: vc.data || '',
      }));
    },

    async createVCard(
      addressBook: AddressBook,
      vCardData: string,
      filename: string
    ): Promise<VCard> {
      const response = await client.createVCard({
        addressBook: addressBook.raw,
        filename,
        vCardString: vCardData,
      });

      // Extract URL and etag from response
      const url = response.url;
      const etag = response.headers.get('etag') || '';

      return {
        url,
        etag,
        data: vCardData,
      };
    },

    async updateVCard(vCard: VCard, newData: string): Promise<VCard> {
      const response = await client.updateVCard({
        vCard: {
          url: vCard.url,
          etag: vCard.etag,
          data: newData, // Updated vCard data
        },
      });

      // Extract etag from response
      const etag = response.headers.get('etag') || vCard.etag;

      return {
        url: vCard.url,
        etag,
        data: newData,
      };
    },

    async deleteVCard(vCard: VCard): Promise<void> {
      await client.deleteVCard({
        vCard: {
          url: vCard.url,
          etag: vCard.etag,
          data: vCard.data,
        },
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
