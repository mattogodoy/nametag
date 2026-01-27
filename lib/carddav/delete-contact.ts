/**
 * Delete contact from CardDAV server
 */

import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { withRetry } from './retry';

/**
 * Delete a contact from CardDAV server
 * @param personId - The person ID to delete from CardDAV
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteFromCardDav(personId: string): Promise<boolean> {
  try {
    // Get the person with their CardDAV mapping
    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        cardDavMapping: {
          include: {
            connection: true,
          },
        },
      },
    });

    if (!person || !person.cardDavMapping) {
      console.log(`No CardDAV mapping found for person ${personId}`);
      return false;
    }

    const mapping = person.cardDavMapping;
    const connection = mapping.connection;

    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Fetch address books
    const addressBooks = await client.fetchAddressBooks();
    if (addressBooks.length === 0) {
      console.error('No address books found');
      return false;
    }

    // Use the first address book (most CardDAV servers have only one)
    const addressBook = addressBooks[0];

    // Delete the vCard from server with retry logic
    await withRetry(async () => {
      await client.deleteVCard({
        url: mapping.href,
        etag: mapping.etag || '',
        data: '', // Not needed for delete
      });
    });

    console.log(`Successfully deleted contact from CardDAV server: ${mapping.href}`);
    return true;
  } catch (error) {
    console.error('Failed to delete contact from CardDAV server:', error);
    return false;
  }
}
