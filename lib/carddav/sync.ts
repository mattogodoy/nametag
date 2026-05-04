import { prisma } from '@/lib/prisma';
import { createCardDavClient, AddressBook, CardDavClientInterface, VCard } from './client';
import { personToVCard } from '@/lib/carddav/vcard-export';
import { vCardToPerson } from '@/lib/carddav/vcard-import';
import { parseVCard } from '@/lib/carddav/vcard-parser';
import type { UnknownProperty } from '@/lib/carddav/vcard-parser';
import { withRetry, categorizeError } from './retry';
import { classifyUpdateFailure } from './update-recovery';
import { getAddressBook } from './address-book';
import { readPhotoForExport, isPhotoFilename } from '@/lib/photo-storage';
import { updatePersonFromVCard } from './vcard-import';

import { v4 as uuidv4 } from 'uuid';
import { buildLocalHash } from './hash';
import { getAlreadyMappedPersonUids } from './mapped-uids';
import { createModuleLogger } from '@/lib/logger';
import { ExternalServiceError } from '@/lib/errors';
import { updateContext } from '@/lib/logging/context';

const log = createModuleLogger('carddav');

/** Preserved vCard properties stored on CardDavMapping for round-tripping. */
export type PreservedProperties = UnknownProperty[];

/**
 * Handle a 412 Precondition Failed on vCard CREATE by adopting the existing
 * server-side vCard and updating it instead.
 *
 * When a CREATE returns 412, the vCard already exists on the server (e.g.,
 * same UID was imported but not mapped). We fetch the existing vCard to get
 * its current ETag/href and then update it with our data.
 */
export async function createOrAdoptVCard(
  client: CardDavClientInterface,
  addressBook: AddressBook,
  vCardData: string,
  filename: string,
  personId: string,
): Promise<VCard> {
  const expectedUrl = addressBook.url.endsWith('/')
    ? `${addressBook.url}${filename}`
    : `${addressBook.url}/${filename}`;
  const existing = await client.fetchVCard(addressBook, expectedUrl);
  if (!existing) {
    throw new Error(`412 recovery failed: could not fetch existing vCard at ${expectedUrl}`);
  }
  log.info({ personId, filename }, '412 on CREATE — adopting existing server vCard');
  const updated = await client.updateVCard(
    { url: existing.url, etag: existing.etag, data: '' },
    vCardData,
  );
  return { url: existing.url, etag: updated.etag, data: vCardData };
}

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

    // Get address book with retry
    const addressBook = await withRetry(
      () => getAddressBook(client, connection),
      { maxAttempts: 3 }
    );

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

    // Get UIDs of persons that already have a mapping under any UID.
    // Prevents creating pending imports for contacts whose person is already
    // mapped (e.g. auto-export with server UID rewrite).
    const alreadyMappedPersonUids = await getAlreadyMappedPersonUids(userId);

    // Collect all UIDs seen on the server during processing (for stale import cleanup)
    const serverUids = new Set<string>();

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
          log.warn('vCard missing UID, skipping');
          result.errors++;
          continue;
        }

        serverUids.add(parsedData.uid);

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

            log.warn(
              { event: 'carddav.conflict.created', personId: fullMapping.personId, mappingId: mapping.id },
              'CardDAV conflict created',
            );

            result.conflicts++;
            continue;
          } else if (remoteChanged) {
            // Only remote changed - update local
            await updatePersonFromVCard(fullMapping.personId, parsedData, userId);

            // Parse enhanced data only when needed (avoids double-parsing every vCard)
            const parsedEnhanced = parseVCard(vCard.data);

            await prisma.cardDavMapping.update({
              where: { id: mapping.id },
              data: {
                etag: vCard.etag,
                href: vCard.url,
                lastRemoteChange: new Date(),
                lastSyncedAt: new Date(),
                remoteVersion: remoteHash,
                syncStatus: 'synced',
                preservedProperties: parsedEnhanced.unknownProperties.length > 0
                  ? parsedEnhanced.unknownProperties
                  : undefined,
              },
            });

            result.updatedLocally++;
          }
          // If only local changed, we'll push in syncToServer
        } else if (!alreadyMappedPersonUids.has(parsedData.uid)) {
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
        log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error processing vCard');
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

    // Clean up stale pending imports: UIDs no longer on the server, or UIDs
    // whose person is already mapped (these would just be skipped during import).
    const mappedUids = new Set(allMappings.map((m) => m.uid));
    const allValidUids = new Set([...serverUids, ...mappedUids]);

    const stalePending = await prisma.cardDavPendingImport.findMany({
      where: { connectionId: connection.id },
      select: { id: true, uid: true },
    });

    const staleIds = stalePending
      .filter((p) => !allValidUids.has(p.uid) || alreadyMappedPersonUids.has(p.uid))
      .map((p) => p.id);

    if (staleIds.length > 0) {
      await prisma.cardDavPendingImport.deleteMany({
        where: { id: { in: staleIds } },
      });
      log.info({ count: staleIds.length }, 'Cleaned up stale pending imports');
    }

    // Return the total pending imports count (not just new ones from this sync)
    const totalPending = await prisma.cardDavPendingImport.count({
      where: { connectionId: connection.id },
    });
    result.pendingImports = totalPending;

    return result;
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Sync from server failed');

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

    // Get address book with retry
    const addressBook = await withRetry(
      () => getAddressBook(client, connection),
      { maxAttempts: 3 }
    );

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

        updateContext({ personId: mapping.personId });

        // Clean up legacy "Unknown vCard Properties" from notes (issue #130)
        if (mapping.person.notes?.includes('--- Unknown vCard Properties ---')) {
          const cleanedNotes = mapping.person.notes
            .replace(/\n?\n?--- Unknown vCard Properties ---[\s\S]*$/, '')
            .trim() || null;
          await prisma.person.update({
            where: { id: mapping.person.id },
            data: { notes: cleanedNotes },
          });
          mapping.person.notes = cleanedNotes;
        }

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

        const preservedProps = mapping.preservedProperties as PreservedProperties | null;
        const vCardData = personToVCard(personWithAllRelations, {
          photoDataUri,
          preservedProperties: preservedProps || undefined,
        });

        if (mapping.href) {
          // Update existing vCard — with 412 (Precondition Failed) recovery.
          // A 412 means our stored ETag is stale. We fetch the fresh ETag
          // from the server and retry once.
          let vCard = {
            url: mapping.href,
            etag: mapping.etag || '',
            data: '',
          };

          let updated: VCard;
          let recoveredAsGone = false;
          try {
            updated = await withRetry(
              () => client.updateVCard(vCard, vCardData),
              { maxAttempts: 3 }
            );
          } catch (updateError) {
            if (!(updateError instanceof ExternalServiceError)) throw updateError;

            if (updateError.status === 412) {
              // 412: fetch fresh ETag from server and retry once
              log.warn({ personId: mapping.personId, href: mapping.href }, '412 Precondition Failed — refreshing ETag and retrying');
              const freshVCard = await client.fetchVCard(addressBook, mapping.href);
              if (!freshVCard) {
                throw new Error(`412 recovery failed: could not fetch vCard at ${mapping.href}`);
              }

              vCard = { url: mapping.href, etag: freshVCard.etag, data: '' };
              updated = await client.updateVCard(vCard, vCardData);
            } else if (
              updateError.status === 400 ||
              updateError.status === 404 ||
              updateError.status === 410
            ) {
              // Disambiguate via GET. Google's `carddav/v1` returns 400
              // INVALID_ARGUMENT both for genuinely-bad bodies AND for PUTs
              // against server-deleted resources, so we can't trust the
              // status code alone. 404/410 are the spec-correct "gone"
              // signals from other servers.
              const recovery = await classifyUpdateFailure(
                client,
                addressBook,
                mapping.href,
                vCard.etag,
              );
              if (recovery.kind === 'gone') {
                log.warn(
                  { event: 'carddav.contact.gone', personId: mapping.personId, href: mapping.href },
                  'CardDAV resource gone server-side; resetting mapping so next push creates a fresh contact',
                );
                await prisma.cardDavMapping.delete({ where: { id: mapping.id } });
                await prisma.person.update({
                  where: { id: mapping.personId },
                  data: { uid: null },
                });
                recoveredAsGone = true;
              } else if (recovery.kind === 'stale-etag') {
                log.warn(
                  { personId: mapping.personId, href: mapping.href },
                  'Server returned a non-412 status with a moved ETag; refreshing and retrying',
                );
                vCard = { url: mapping.href, etag: recovery.freshEtag, data: '' };
                updated = await client.updateVCard(vCard, vCardData);
              } else {
                throw updateError;
              }
            } else {
              throw updateError;
            }
          }

          if (recoveredAsGone) {
            // Mapping is gone; skip the post-update bookkeeping below.
            continue;
          }

          // Store the new etag
          await prisma.cardDavMapping.update({
            where: { id: mapping.id },
            data: {
              etag: updated!.etag,
            },
          });

          result.updatedRemotely++;
        } else {
          // Create new vCard with retry.
          // On 412, the vCard already exists on the server (e.g., same UID) —
          // fetch it to get the current ETag/href and update instead.
          const filename = `${mapping.uid || uuidv4()}.vcf`;
          let created: VCard;
          try {
            created = await withRetry(
              () => client.createVCard(addressBook, vCardData, filename),
              { maxAttempts: 3 }
            );
          } catch (createError) {
            if (!(createError instanceof ExternalServiceError && createError.status === 412)) throw createError;
            created = await createOrAdoptVCard(client, addressBook, vCardData, filename, mapping.personId);
          }

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
        log.warn(
          {
            event: 'carddav.push.failed',
            personId: mapping.personId,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          'CardDAV push failed',
        );
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
        deletedAt: null,
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

        // Create vCard on server. On 412, the vCard already exists (e.g., same UID
        // was imported from server but not yet mapped) — adopt it and update instead.
        let created: VCard;
        try {
          updateContext({ personId: person.id });
          created = await withRetry(
            () => client.createVCard(addressBook, vCardData, filename),
            { maxAttempts: 3 }
          );
        } catch (createError) {
          if (!(createError instanceof ExternalServiceError && createError.status === 412)) throw createError;
          created = await createOrAdoptVCard(client, addressBook, vCardData, filename, person.id);
        }

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
        log.warn(
          {
            event: 'carddav.push.failed',
            personId: person.id,
            err: error instanceof Error ? error : new Error(String(error)),
          },
          'CardDAV push failed (unmapped)',
        );
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
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Sync to server failed');

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
    log.info({ userId }, 'Sync already in progress, skipping');
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

  const syncStart = Date.now();
  let timedOut = false;
  let timerId: ReturnType<typeof setTimeout> | undefined;

  try {
    const syncOperation = async (): Promise<SyncResult> => {
      const pullResult = await syncFromServer(userId, onProgress);
      const pushResult = await syncToServer(userId, onProgress);

      const summary = {
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
      log.info(
        {
          event: 'carddav.sync.finished',
          imported: summary.imported,
          exported: summary.exported,
          updatedLocally: summary.updatedLocally,
          updatedRemotely: summary.updatedRemotely,
          conflicts: summary.conflicts,
          errors: summary.errors,
          pendingImports: summary.pendingImports,
          durationMs: Date.now() - syncStart,
        },
        'CardDAV sync finished',
      );
      return summary;
    };

    return await Promise.race([
      syncOperation().finally(() => {
        clearTimeout(timerId);
        // If we timed out, the finally block below skipped lock release.
        // Release it now that the in-flight operation has actually finished.
        if (timedOut) {
          releaseSyncLock(userId).catch((err) =>
            log.error({ err: err instanceof Error ? err : new Error(String(err)) }, 'Failed to release sync lock after timed-out operation completed')
          );
        }
      }),
      new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          timedOut = true;
          reject(new Error('Sync timed out'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timerId);
    // Only release the lock if the sync completed (success or error).
    // On timeout, the sync operation is still running — releasing the lock
    // would allow overlapping syncs. The stale lock detection (10min threshold
    // in acquireSyncLock) will break the lock if the operation never finishes.
    if (!timedOut) {
      await releaseSyncLock(userId);
    }
  }
}

