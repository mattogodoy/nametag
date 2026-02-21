import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { personToVCard, vCardToPerson } from '@/lib/vcard';
import { withRetry, categorizeError } from './retry';
import { readPhotoForExport, isPhotoFilename } from '@/lib/photo-storage';
import { updatePersonFromVCard } from './person-from-vcard';

import { v4 as uuidv4 } from 'uuid';
import { buildLocalHash } from './hash';
import { logger } from '@/lib/logger';

/**
 * Acquire a sync lock for a user. Returns true if lock was acquired.
 * Uses optimistic locking: only updates if syncInProgress is false.
 * Breaks stale locks older than 10 minutes.
 */
async function acquireSyncLock(userId: string): Promise<boolean> {
  const staleThreshold = 10 * 60 * 1000; // 10 minutes
  const now = new Date();

  const result = await prisma.cardDavConnection.updateMany({
    where: {
      userId,
      OR: [
        { syncInProgress: false },
        { syncStartedAt: { lt: new Date(now.getTime() - staleThreshold) } },
      ],
    },
    data: {
      syncInProgress: true,
      syncStartedAt: now,
    },
  });

  return result.count > 0;
}

async function releaseSyncLock(userId: string): Promise<void> {
  await prisma.cardDavConnection.updateMany({
    where: { userId },
    data: {
      syncInProgress: false,
      syncStartedAt: null,
    },
  });
}

interface SyncResult {
  imported: number;
  exported: number;
  updatedLocally: number;  // Contacts updated in Nametag from server changes
  updatedRemotely: number; // Contacts updated on server from Nametag changes
  conflicts: number;
  errors: number;
  errorMessages: string[];
  pendingImports?: number;
}

export interface SyncProgressEvent {
  phase: 'pull' | 'push';
  step: 'connecting' | 'fetching' | 'processing';
  current?: number;
  total?: number;
  contact?: string;
}

export type SyncProgressCallback = (event: SyncProgressEvent) => void;

/**
 * Sync from CardDAV server to local database
 */
export async function syncFromServer(
  userId: string,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const result: SyncResult = {
    imported: 0,
    exported: 0,
    updatedLocally: 0,
    updatedRemotely: 0,
    conflicts: 0,
    errors: 0,
    errorMessages: [],
    pendingImports: 0,
  };

  try {
    // Get connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new Error('CardDAV connection not found');
    }

    onProgress?.({ phase: 'pull', step: 'connecting' });

    // Create CardDAV client
    const client = await createCardDavClient(connection);

    onProgress?.({ phase: 'pull', step: 'fetching' });

    // Get address books with retry
    const addressBooks = await withRetry(
      () => client.fetchAddressBooks(),
      { maxAttempts: 3 }
    );

    if (addressBooks.length === 0) {
      throw new Error('No address books found');
    }

    // Use the first address book
    const addressBook = addressBooks[0];

    // Fetch vCards from address book with retry
    const vCards = await withRetry(
      () => client.fetchVCards(addressBook),
      { maxAttempts: 3 }
    );

    // Pre-load all mappings for this connection in a single query.
    // Index by UID and href for O(1) lookups instead of per-vCard DB queries.
    const allMappings = await prisma.cardDavMapping.findMany({
      where: { connectionId: connection.id },
    });

    const mappingByUid = new Map<string, typeof allMappings[number]>();
    const mappingByHref = new Map<string, typeof allMappings[number]>();
    for (const m of allMappings) {
      if (m.uid) mappingByUid.set(m.uid, m);
      if (m.href) mappingByHref.set(m.href, m);
    }

    // Process each vCard
    for (let i = 0; i < vCards.length; i++) {
      const vCard = vCards[i];
      try {
        // Parse vCard
        const parsedData = vCardToPerson(vCard.data);

        onProgress?.({
          phase: 'pull',
          step: 'processing',
          current: i + 1,
          total: vCards.length,
          contact: parsedData.name
            ? `${parsedData.name}${parsedData.surname ? ` ${parsedData.surname}` : ''}`
            : parsedData.surname || 'Unknown',
        });

        if (!parsedData.uid) {
          console.warn('vCard missing UID, skipping');
          result.errors++;
          continue;
        }

        // O(1) in-memory lookup: try UID first, then href as fallback.
        // The href fallback handles servers that rewrite vCard UIDs
        // (e.g., Google Contacts assigns its own UID after export).
        let mapping = mappingByUid.get(parsedData.uid) ?? null;
        let matchedByHref = false;

        if (!mapping && vCard.url) {
          mapping = mappingByHref.get(vCard.url) ?? null;
          if (mapping) {
            matchedByHref = true;
          }
        }

        // When matched by href, update the stored UID to match the server's
        // so future syncs can match by UID directly.
        if (matchedByHref && mapping && parsedData.uid) {
          await prisma.cardDavMapping.update({
            where: { id: mapping.id },
            data: { uid: parsedData.uid },
          });
          await prisma.person.update({
            where: { id: mapping.personId },
            data: { uid: parsedData.uid },
          });
          // Update in-memory index so subsequent vCards can find it by UID
          mappingByUid.set(parsedData.uid, mapping);
        }

        if (mapping) {
          const remoteChanged = mapping.etag !== vCard.etag;

          // Check if both local and remote changed since last sync
          const localChanged = mapping.lastLocalChange &&
            mapping.lastSyncedAt &&
            mapping.lastLocalChange > mapping.lastSyncedAt;

          if (!remoteChanged && !localChanged) {
            // Nothing changed - skip without any DB queries
            continue;
          }

          // Only load full person data when we actually need it
          // (conflict detection or local update)
          const fullMapping = await prisma.cardDavMapping.findFirst({
            where: { id: mapping.id },
            include: {
              person: {
                include: {
                  phoneNumbers: true,
                  emails: true,
                  addresses: true,
                  urls: true,
                  imHandles: true,
                  locations: true,
                  customFields: true,
                },
              },
            },
          });

          if (!fullMapping) {
            continue;
          }

          const remoteHash = buildLocalHash(parsedData);

          if (localChanged && remoteChanged) {
            // CONFLICT - both changed
            const localData = {
              ...fullMapping.person,
              phoneNumbers: fullMapping.person.phoneNumbers,
              emails: fullMapping.person.emails,
              addresses: fullMapping.person.addresses,
              urls: fullMapping.person.urls,
              imHandles: fullMapping.person.imHandles,
              locations: fullMapping.person.locations,
              customFields: fullMapping.person.customFields,
            };

            await prisma.cardDavConflict.create({
              data: {
                mappingId: mapping.id,
                localVersion: JSON.stringify(localData),
                remoteVersion: JSON.stringify(parsedData),
              },
            });

            // Update etag so the next sync won't detect the same remote change.
            // This is critical: without updating the etag, resolving the conflict
            // and syncing again would recreate the same conflict because
            // mapping.etag would still differ from the server's etag.
            await prisma.cardDavMapping.update({
              where: { id: mapping.id },
              data: {
                syncStatus: 'conflict',
                etag: vCard.etag,
                href: vCard.url,
              },
            });

            result.conflicts++;
            continue;
          } else if (remoteChanged) {
            // Only remote changed - update local
            await updatePersonFromVCard(fullMapping.personId, parsedData, userId);

            await prisma.cardDavMapping.update({
              where: { id: mapping.id },
              data: {
                etag: vCard.etag,
                href: vCard.url,
                lastRemoteChange: new Date(),
                lastSyncedAt: new Date(),
                remoteVersion: remoteHash,
                syncStatus: 'synced',
              },
            });

            result.updatedLocally++;
          }
          // If only local changed, we'll push in syncToServer
        } else {
          // New contact from server - add to pending imports
          await prisma.cardDavPendingImport.upsert({
            where: {
              connectionId_uid: {
                connectionId: connection.id,
                uid: parsedData.uid,
              },
            },
            create: {
              connectionId: connection.id,
              uid: parsedData.uid,
              href: vCard.url,
              etag: vCard.etag,
              vCardData: vCard.data,
              displayName: parsedData.name || parsedData.surname || 'Unknown',
              discoveredAt: new Date(),
            },
            update: {
              vCardData: vCard.data,
              displayName: parsedData.name || parsedData.surname || 'Unknown',
              etag: vCard.etag,
            },
          });
          result.pendingImports = (result.pendingImports || 0) + 1;
        }
      } catch (error) {
        console.error('Error processing vCard:', error);
        result.errors++;
        result.errorMessages.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Update sync token
    await prisma.cardDavConnection.update({
      where: { id: connection.id },
      data: {
        syncToken: typeof addressBook.syncToken === 'string' ? addressBook.syncToken : null,
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });

    // Return the total pending imports count (not just new ones from this sync)
    const totalPending = await prisma.cardDavPendingImport.count({
      where: { connectionId: connection.id },
    });
    result.pendingImports = totalPending;

    return result;
  } catch (error) {
    console.error('Sync from server failed:', error);

    // Categorize error for better user feedback
    const categorized = categorizeError(error);

    // Update connection with error
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId },
    });

    if (connection) {
      await prisma.cardDavConnection.update({
        where: { id: connection.id },
        data: {
          lastError: categorized.userMessage,
          lastErrorAt: new Date(),
        },
      });
    }

    // Re-throw with user-friendly message
    const enhancedError = new Error(categorized.userMessage);
    (enhancedError as { category?: string }).category = categorized.category;
    throw enhancedError;
  }
}

/**
 * Sync to CardDAV server from local database
 */
export async function syncToServer(
  userId: string,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  const result: SyncResult = {
    imported: 0,
    exported: 0,
    updatedLocally: 0,
    updatedRemotely: 0,
    conflicts: 0,
    errors: 0,
    errorMessages: [],
    pendingImports: 0,
  };

  try {
    // Get connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new Error('CardDAV connection not found');
    }

    onProgress?.({ phase: 'push', step: 'connecting' });

    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Get address books with retry
    const addressBooks = await withRetry(
      () => client.fetchAddressBooks(),
      { maxAttempts: 3 }
    );

    if (addressBooks.length === 0) {
      throw new Error('No address books found');
    }

    const addressBook = addressBooks[0];

    onProgress?.({ phase: 'push', step: 'fetching' });

    // Only fetch mappings with pending local changes.
    // When local edits occur, syncStatus is set to 'pending', so we can
    // skip the much larger set of unchanged 'synced' mappings entirely.
    const mappings = await prisma.cardDavMapping.findMany({
      where: {
        connectionId: connection.id,
        syncStatus: 'pending',
      },
      include: {
        person: {
          include: {
            phoneNumbers: true,
            emails: true,
            addresses: true,
            urls: true,
            imHandles: true,
            locations: true,
            customFields: true,
            importantDates: true,
            groups: { include: { group: true } },
            relationshipsFrom: { include: { relatedPerson: true } },
          },
        },
      },
    });

    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i];
      try {
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: i + 1,
          total: mappings.length,
          contact: mapping.person.name
            ? `${mapping.person.name}${mapping.person.surname ? ` ${mapping.person.surname}` : ''}`
            : mapping.person.surname || 'Unknown',
        });

        // Convert person to vCard
        const personWithAllRelations = {
          ...mapping.person,
          importantDates: mapping.person.importantDates || [],
          relationshipsFrom: mapping.person.relationshipsFrom || [],
          groups: mapping.person.groups || [],
        };

        // Load photo from file for export if needed
        let photoDataUri: string | undefined;
        if (mapping.person.photo && isPhotoFilename(mapping.person.photo)) {
          const loaded = await readPhotoForExport(userId, mapping.person.photo);
          if (loaded) photoDataUri = loaded;
        }

        const vCardData = personToVCard(personWithAllRelations, { photoDataUri });

        if (mapping.href) {
          // Update existing vCard with retry
          const vCard = {
            url: mapping.href,
            etag: mapping.etag || '',
            data: '',
          };
          const updated = await withRetry(
            () => client.updateVCard(vCard, vCardData),
            { maxAttempts: 3 }
          );

          // Store the new etag so the next sync doesn't see a false "remote changed"
          await prisma.cardDavMapping.update({
            where: { id: mapping.id },
            data: {
              etag: updated.etag,
            },
          });

          result.updatedRemotely++;
        } else {
          // Create new vCard with retry
          const filename = `${mapping.uid || uuidv4()}.vcf`;
          const created = await withRetry(
            () => client.createVCard(addressBook, vCardData, filename),
            { maxAttempts: 3 }
          );

          await prisma.cardDavMapping.update({
            where: { id: mapping.id },
            data: {
              href: created.url,
              etag: created.etag,
            },
          });

          result.exported++;
        }

        // Update mapping
        await prisma.cardDavMapping.update({
          where: { id: mapping.id },
          data: {
            lastSyncedAt: new Date(),
            localVersion: buildLocalHash(mapping.person),
            syncStatus: 'synced',
          },
        });
      } catch (error) {
        console.error('Error pushing vCard:', error);
        result.errors++;
        result.errorMessages.push(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    // Export unmapped contacts (created in Nametag before connecting to CardDAV)
    const mappedPersonIds = await prisma.cardDavMapping.findMany({
      where: { connectionId: connection.id },
      select: { personId: true },
    });
    const mappedIds = mappedPersonIds.map((m) => m.personId);

    const unmappedPersons = await prisma.person.findMany({
      where: {
        userId,
        cardDavSyncEnabled: true,
        ...(mappedIds.length > 0 ? { id: { notIn: mappedIds } } : {}),
      },
      include: {
        phoneNumbers: true,
        emails: true,
        addresses: true,
        urls: true,
        imHandles: true,
        locations: true,
        customFields: true,
        importantDates: true,
        relationshipsFrom: {
          include: { relatedPerson: true },
        },
        groups: {
          include: { group: true },
        },
      },
    });

    // Process unmapped persons in batches to avoid overwhelming the CardDAV server
    const BATCH_SIZE = 50;
    const BATCH_DELAY_MS = 100;

    for (let i = 0; i < unmappedPersons.length; i++) {
      const person = unmappedPersons[i];
      try {
        onProgress?.({
          phase: 'push',
          step: 'processing',
          current: i + 1,
          total: unmappedPersons.length,
          contact: person.name
            ? `${person.name}${person.surname ? ` ${person.surname}` : ''}`
            : person.surname || 'Unknown',
        });

        // Ensure person has a UID before generating vCard (CardDAV requires UID)
        const uid = person.uid || uuidv4();
        if (!person.uid) {
          await prisma.person.update({
            where: { id: person.id },
            data: { uid },
          });
          person.uid = uid;
        }

        // Load photo from file for export if needed
        let unmappedPhotoDataUri: string | undefined;
        if (person.photo && isPhotoFilename(person.photo)) {
          const loaded = await readPhotoForExport(userId, person.photo);
          if (loaded) unmappedPhotoDataUri = loaded;
        }

        const vCardData = personToVCard(person, { photoDataUri: unmappedPhotoDataUri });
        const filename = `${uid}.vcf`;

        const created = await withRetry(
          () => client.createVCard(addressBook, vCardData, filename),
          { maxAttempts: 3 }
        );

        // Create mapping
        await prisma.cardDavMapping.create({
          data: {
            connectionId: connection.id,
            personId: person.id,
            uid,
            href: created.url,
            etag: created.etag,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          },
        });

        result.exported++;
      } catch (error) {
        console.error('Error exporting unmapped contact:', error);
        result.errors++;
        result.errorMessages.push(
          `Failed to export ${person.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Add delay between batches to respect server rate limits
      if ((i + 1) % BATCH_SIZE === 0 && i + 1 < unmappedPersons.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    return result;
  } catch (error) {
    console.error('Sync to server failed:', error);

    // Categorize error for better user feedback
    const categorized = categorizeError(error);

    // Update connection with error
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId },
    });

    if (connection) {
      await prisma.cardDavConnection.update({
        where: { id: connection.id },
        data: {
          lastError: categorized.userMessage,
          lastErrorAt: new Date(),
        },
      });
    }

    // Re-throw with user-friendly message
    const enhancedError = new Error(categorized.userMessage);
    (enhancedError as { category?: string }).category = categorized.category;
    throw enhancedError;
  }
}

/**
 * Bidirectional sync with overall timeout protection.
 * Default timeout is 5 minutes to prevent slow servers from blocking the cron queue.
 */
export async function bidirectionalSync(
  userId: string,
  onProgress?: SyncProgressCallback,
  timeoutMs: number = 5 * 60 * 1000
): Promise<SyncResult> {
  const lockAcquired = await acquireSyncLock(userId);
  if (!lockAcquired) {
    logger.info('Sync already in progress, skipping', { userId });
    return {
      imported: 0,
      exported: 0,
      updatedLocally: 0,
      updatedRemotely: 0,
      conflicts: 0,
      errors: 0,
      errorMessages: [],
      pendingImports: 0,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Check for abort before pulling from server
    if (controller.signal.aborted) {
      throw new Error('Sync timed out');
    }

    // First, pull from server
    const pullResult = await syncFromServer(userId, onProgress);

    // Check for abort before pushing to server
    if (controller.signal.aborted) {
      throw new Error('Sync timed out');
    }

    // Then, push to server
    const pushResult = await syncToServer(userId, onProgress);

    return {
      imported: pullResult.imported,
      exported: pushResult.exported,
      updatedLocally: pullResult.updatedLocally + pushResult.updatedLocally,
      updatedRemotely: pullResult.updatedRemotely + pushResult.updatedRemotely,
      conflicts: pullResult.conflicts + pushResult.conflicts,
      errors: pullResult.errors + pushResult.errors,
      errorMessages: [
        ...pullResult.errorMessages,
        ...pushResult.errorMessages,
      ],
      pendingImports: (pullResult.pendingImports || 0) + (pushResult.pendingImports || 0),
    };
  } finally {
    clearTimeout(timeoutId);
    await releaseSyncLock(userId);
  }
}

