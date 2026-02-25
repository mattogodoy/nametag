/**
 * Delete contact from CardDAV server
 */

import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { withRetry } from './retry';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

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
      log.info({ personId }, 'No CardDAV mapping found for person');
      return false;
    }

    const mapping = person.cardDavMapping;
    const connection = mapping.connection;

    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Delete the vCard from server with retry logic
    await withRetry(async () => {
      await client.deleteVCard({
        url: mapping.href,
        etag: mapping.etag || '',
        data: '', // Not needed for delete
      });
    });

    log.info({ href: mapping.href }, 'Successfully deleted contact from CardDAV server');
    return true;
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Failed to delete contact from CardDAV server');
    return false;
  }
}
