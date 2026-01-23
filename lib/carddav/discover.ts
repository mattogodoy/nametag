import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';

interface DiscoveryResult {
  discovered: number;
  errors: number;
  errorMessages: string[];
}

/**
 * Discover new contacts from CardDAV server
 */
export async function discoverNewContacts(userId: string): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    discovered: 0,
    errors: 0,
    errorMessages: [],
  };

  try {
    // Get connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new Error('CardDAV connection not found');
    }

    if (!connection.syncEnabled) {
      throw new Error('Sync is disabled for this connection');
    }

    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Get address books
    const addressBooks = await client.fetchAddressBooks();
    if (addressBooks.length === 0) {
      throw new Error('No address books found');
    }

    // Use the first address book
    const addressBook = addressBooks[0];

    // Fetch all vCards
    const vCards = await client.fetchVCards(addressBook);

    // Get all existing mappings for this connection
    const existingMappings = await prisma.cardDavMapping.findMany({
      where: {
        connectionId: connection.id,
      },
      select: {
        uid: true,
      },
    });

    const existingUids = new Set(existingMappings.map((m) => m.uid));

    // Get all existing pending imports
    const existingPending = await prisma.cardDavPendingImport.findMany({
      where: {
        connectionId: connection.id,
      },
      select: {
        uid: true,
      },
    });

    const pendingUids = new Set(existingPending.map((p) => p.uid));

    // Process each vCard
    for (const vCard of vCards) {
      try {
        // Extract UID from vCard
        const uidMatch = vCard.data.match(/^UID:(.+)$/m);
        if (!uidMatch) {
          console.warn('vCard missing UID, skipping');
          continue;
        }

        const uid = uidMatch[1].trim();

        // Skip if already imported or already pending
        if (existingUids.has(uid) || pendingUids.has(uid)) {
          continue;
        }

        // Extract display name (FN property)
        const fnMatch = vCard.data.match(/^FN:(.+)$/m);
        const displayName = fnMatch ? fnMatch[1].trim() : 'Unknown';

        // Add to pending imports
        await prisma.cardDavPendingImport.create({
          data: {
            connectionId: connection.id,
            uid,
            href: vCard.url,
            vCardData: vCard.data,
            displayName,
            discoveredAt: new Date(),
          },
        });

        result.discovered++;
      } catch (error) {
        console.error('Error processing vCard:', error);
        result.errors++;
        result.errorMessages.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Update connection
    await prisma.cardDavConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });

    return result;
  } catch (error) {
    console.error('Discovery failed:', error);

    // Update connection with error
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId },
    });

    if (connection) {
      await prisma.cardDavConnection.update({
        where: { id: connection.id },
        data: {
          lastError: error instanceof Error ? error.message : 'Discovery failed',
          lastErrorAt: new Date(),
        },
      });
    }

    throw error;
  }
}
