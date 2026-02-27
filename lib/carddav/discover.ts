import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { vCardToPerson } from '@/lib/vcard';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

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
        // Parse vCard to reliably extract UID and display name.
        // Regex extraction is fragile with line folding and parameters
        // (e.g. UID;VALUE=uri:...) so we use the full parser.
        const parsed = vCardToPerson(vCard.data);
        if (!parsed.uid) {
          log.warn('vCard missing UID, skipping');
          continue;
        }

        const uid = parsed.uid;

        // Skip if already imported or already pending
        if (existingUids.has(uid) || pendingUids.has(uid)) {
          continue;
        }

        const displayName = parsed.name
          ? `${parsed.name}${parsed.surname ? ` ${parsed.surname}` : ''}`
          : parsed.surname || 'Unknown';

        // Add to pending imports
        await prisma.cardDavPendingImport.create({
          data: {
            connectionId: connection.id,
            uid,
            href: vCard.url,
            etag: vCard.etag,
            vCardData: vCard.data,
            displayName,
            discoveredAt: new Date(),
          },
        });

        result.discovered++;
      } catch (error) {
        log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error processing vCard');
        result.errors++;
        result.errorMessages.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Clean up stale pending imports whose UIDs no longer exist on the server.
    // This handles contacts that were deleted from the CardDAV server after
    // being discovered but before being imported into Nametag.
    const serverUids = new Set<string>();
    for (const vCard of vCards) {
      try {
        const parsed = vCardToPerson(vCard.data);
        if (parsed.uid) serverUids.add(parsed.uid);
      } catch {
        // Skip unparseable vCards
      }
    }

    // Also include UIDs that are already mapped (imported) — those aren't stale
    const allValidUids = new Set([...serverUids, ...existingUids]);

    // Find pending imports whose UIDs are no longer on the server
    const allPending = await prisma.cardDavPendingImport.findMany({
      where: { connectionId: connection.id },
      select: { id: true, uid: true },
    });

    const staleIds = allPending
      .filter((p) => !allValidUids.has(p.uid))
      .map((p) => p.id);

    if (staleIds.length > 0) {
      await prisma.cardDavPendingImport.deleteMany({
        where: { id: { in: staleIds } },
      });
      log.info({ count: staleIds.length }, 'Cleaned up stale pending imports');
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
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Discovery failed');

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
