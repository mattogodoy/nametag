import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { personToVCard, vCardToPerson } from '@/lib/vcard';
import { withRetry, categorizeError } from './retry';
import { savePhoto, readPhotoForExport, isPhotoFilename } from '@/lib/photo-storage';

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

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

/**
 * Generate a hash of person data for conflict detection
 */
function generatePersonHash(personData: unknown): string {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(personData));
  return hash.digest('hex');
}

/**
 * Sync from CardDAV server to local database
 */
export async function syncFromServer(
  userId: string
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

    // Use the first address book
    const addressBook = addressBooks[0];

    // Fetch vCards from address book with retry
    const vCards = await withRetry(
      () => client.fetchVCards(addressBook),
      { maxAttempts: 3 }
    );

    // Process each vCard
    for (const vCard of vCards) {
      try {
        // Parse vCard
        const parsedData = vCardToPerson(vCard.data);

        if (!parsedData.uid) {
          console.warn('vCard missing UID, skipping');
          result.errors++;
          continue;
        }

        // Check if mapping exists
        const mapping = await prisma.cardDavMapping.findFirst({
          where: {
            connectionId: connection.id,
            uid: parsedData.uid,
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
              },
            },
          },
        });

        if (mapping) {
          // Existing contact - check for conflicts
          const localData = {
            ...mapping.person,
            phoneNumbers: mapping.person.phoneNumbers,
            emails: mapping.person.emails,
            addresses: mapping.person.addresses,
            urls: mapping.person.urls,
            imHandles: mapping.person.imHandles,
            locations: mapping.person.locations,
            customFields: mapping.person.customFields,
          };

          const remoteHash = generatePersonHash(parsedData);

          // Check if both local and remote changed since last sync
          const localChanged = mapping.lastLocalChange &&
            mapping.lastSyncedAt &&
            mapping.lastLocalChange > mapping.lastSyncedAt;

          const remoteChanged = mapping.etag !== vCard.etag;

          if (localChanged && remoteChanged) {
            // CONFLICT - both changed
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
            await updatePersonFromVCard(mapping.personId, parsedData, userId);

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
        syncToken: addressBook.syncToken || null,
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
  userId: string
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

    // Find all mappings with pending local changes
    const mappings = await prisma.cardDavMapping.findMany({
      where: {
        connectionId: connection.id,
        syncStatus: { in: ['pending', 'synced'] },
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
          },
        },
      },
    });

    for (const mapping of mappings) {
      try {
        // Check if local changed since last sync
        const localChanged = mapping.lastLocalChange &&
          mapping.lastSyncedAt &&
          mapping.lastLocalChange > mapping.lastSyncedAt;

        if (!localChanged && mapping.syncStatus === 'synced') {
          // No local changes, skip
          continue;
        }

        // Convert person to vCard
        const personWithAllRelations = {
          ...mapping.person,
          importantDates: [],
          relationshipsFrom: [],
          groups: [],
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
        const localData = {
          ...mapping.person,
          phoneNumbers: mapping.person.phoneNumbers,
          emails: mapping.person.emails,
          addresses: mapping.person.addresses,
          urls: mapping.person.urls,
          imHandles: mapping.person.imHandles,
          locations: mapping.person.locations,
          customFields: mapping.person.customFields,
        };

        await prisma.cardDavMapping.update({
          where: { id: mapping.id },
          data: {
            lastSyncedAt: new Date(),
            localVersion: generatePersonHash(localData),
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

    for (const person of unmappedPersons) {
      try {
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
 * Bidirectional sync
 */
export async function bidirectionalSync(userId: string): Promise<SyncResult> {
  // First, pull from server
  const pullResult = await syncFromServer(userId);

  // Then, push to server
  const pushResult = await syncToServer(userId);

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
}

/**
 * Helper: Update person from vCard data
 */
async function updatePersonFromVCard(
  personId: string,
  parsedData: ReturnType<typeof vCardToPerson>,
  userId: string
): Promise<void> {
  // Delete all multi-value fields
  await prisma.$transaction([
    prisma.personPhone.deleteMany({ where: { personId } }),
    prisma.personEmail.deleteMany({ where: { personId } }),
    prisma.personAddress.deleteMany({ where: { personId } }),
    prisma.personUrl.deleteMany({ where: { personId } }),
    prisma.personIM.deleteMany({ where: { personId } }),
    prisma.personLocation.deleteMany({ where: { personId } }),
    prisma.personCustomField.deleteMany({ where: { personId } }),
  ]);

  // Save photo as file if present
  let photoValue = parsedData.photo;
  if (photoValue) {
    const filename = await savePhoto(userId, personId, photoValue);
    if (filename) {
      photoValue = filename;
    }
    // If savePhoto fails, keep the original value as fallback
  }

  // Update person with new data
  await prisma.person.update({
    where: { id: personId },
    data: {
      name: parsedData.name,
      surname: parsedData.surname,
      middleName: parsedData.middleName,
      prefix: parsedData.prefix,
      suffix: parsedData.suffix,
      nickname: parsedData.nickname,
      organization: parsedData.organization,
      jobTitle: parsedData.jobTitle,
      photo: photoValue,
      gender: parsedData.gender,
      anniversary: parsedData.anniversary,
      notes: parsedData.notes,
      uid: parsedData.uid,

      // Create new multi-value fields
      phoneNumbers: parsedData.phoneNumbers
        ? { create: parsedData.phoneNumbers }
        : undefined,
      emails: parsedData.emails
        ? { create: parsedData.emails }
        : undefined,
      addresses: parsedData.addresses
        ? { create: parsedData.addresses }
        : undefined,
      urls: parsedData.urls
        ? { create: parsedData.urls }
        : undefined,
      imHandles: parsedData.imHandles
        ? { create: parsedData.imHandles }
        : undefined,
      locations: parsedData.locations
        ? { create: parsedData.locations }
        : undefined,
      customFields: parsedData.customFields
        ? { create: parsedData.customFields }
        : undefined,
    },
  });
}
