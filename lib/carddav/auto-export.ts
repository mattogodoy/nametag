import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { personToVCard } from '@/lib/vcard';
import { readPhotoForExport, isPhotoFilename } from '@/lib/photo-storage';
import { withRetry } from './retry';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Auto-export a person to CardDAV server
 */
export async function autoExportPerson(personId: string): Promise<void> {
  // Get person with all relations
  const person = await prisma.person.findUnique({
    where: { id: personId },
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
        include: {
          relatedPerson: true,
        },
      },
      groups: {
        include: {
          group: true,
        },
      },
    },
  });

  if (!person) {
    throw new Error('Person not found');
  }

  // Get user's CardDAV connection
  const connection = await prisma.cardDavConnection.findUnique({
    where: { userId: person.userId },
  });

  if (!connection || !connection.syncEnabled || !connection.autoExportNew) {
    // Auto-export not enabled, skip
    return;
  }

  // Check if already mapped
  const existingMapping = await prisma.cardDavMapping.findUnique({
    where: { personId: person.id },
  });

  if (existingMapping) {
    // Already exported, skip
    return;
  }

  try {
    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Get address books
    const addressBooks = await client.fetchAddressBooks();
    if (addressBooks.length === 0) {
      throw new Error('No address books found');
    }

    const addressBook = addressBooks[0];

    // Ensure person has a UID before generating vCard (CardDAV requires UID)
    const uid: string = person.uid || uuidv4();
    if (!person.uid) {
      await prisma.person.update({
        where: { id: person.id },
        data: { uid },
      });
      person.uid = uid;
    }

    // Load photo from file for export if needed
    let photoDataUri: string | undefined;
    if (person.photo && isPhotoFilename(person.photo)) {
      const loaded = await readPhotoForExport(person.userId, person.photo);
      if (loaded) photoDataUri = loaded;
    }

    // Convert to vCard
    const vCardData = personToVCard(person, { photoDataUri });

    // Create vCard on server
    const filename = `${uid}.vcf`;
    const created = await withRetry(() => client.createVCard(addressBook, vCardData, filename));

    // Create mapping
    const localData = {
      ...person,
      phoneNumbers: person.phoneNumbers,
      emails: person.emails,
      addresses: person.addresses,
      urls: person.urls,
      imHandles: person.imHandles,
      locations: person.locations,
      customFields: person.customFields,
    };

    const localHash = crypto.createHash('sha256')
      .update(JSON.stringify(localData))
      .digest('hex');

    await prisma.cardDavMapping.create({
      data: {
        connectionId: connection.id,
        personId: person.id,
        uid,
        href: created.url,
        etag: created.etag,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        localVersion: localHash,
      },
    });

    logger.info('Auto-exported person to CardDAV', { personId: person.id });
  } catch (error) {
    logger.error('Auto-export failed', { error: error instanceof Error ? error.message : String(error) });

    // Update connection with error
    await prisma.cardDavConnection.update({
      where: { id: connection.id },
      data: {
        lastError: error instanceof Error ? error.message : 'Auto-export failed',
        lastErrorAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Auto-update a person on CardDAV server
 */
export async function autoUpdatePerson(personId: string): Promise<void> {
  // Get person with all relations
  const person = await prisma.person.findUnique({
    where: { id: personId },
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
        include: {
          relatedPerson: true,
        },
      },
      groups: {
        include: {
          group: true,
        },
      },
    },
  });

  if (!person) {
    throw new Error('Person not found');
  }

  // Get user's CardDAV connection
  const connection = await prisma.cardDavConnection.findUnique({
    where: { userId: person.userId },
  });

  if (!connection) {
    return;
  }

  // Get mapping
  const mapping = await prisma.cardDavMapping.findUnique({
    where: { personId: person.id },
  });

  if (!mapping) {
    // No mapping — mark lastLocalChange for sync to pick up later,
    // or auto-export if enabled
    if (connection.autoExportNew) {
      await autoExportPerson(personId);
    }
    return;
  }

  // Always mark as locally changed so manual sync can pick it up
  await prisma.cardDavMapping.update({
    where: { id: mapping.id },
    data: {
      lastLocalChange: new Date(),
      syncStatus: 'pending',
    },
  });

  // If auto-sync is disabled, the change will be pushed on next manual sync
  if (!connection.syncEnabled) {
    return;
  }

  try {
    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Load photo from file for export if needed
    let updatePhotoDataUri: string | undefined;
    if (person.photo && isPhotoFilename(person.photo)) {
      const loaded = await readPhotoForExport(person.userId, person.photo);
      if (loaded) updatePhotoDataUri = loaded;
    }

    // Convert to vCard
    const vCardData = personToVCard(person, { photoDataUri: updatePhotoDataUri });

    // Update vCard on server
    const vCard = {
      url: mapping.href,
      etag: mapping.etag || '',
      data: '',
    };

    const updated = await withRetry(() => client.updateVCard(vCard, vCardData));

    // Update mapping
    const localData = {
      ...person,
      phoneNumbers: person.phoneNumbers,
      emails: person.emails,
      addresses: person.addresses,
      urls: person.urls,
      imHandles: person.imHandles,
      locations: person.locations,
      customFields: person.customFields,
    };

    const localHash = crypto.createHash('sha256')
      .update(JSON.stringify(localData))
      .digest('hex');

    await prisma.cardDavMapping.update({
      where: { id: mapping.id },
      data: {
        etag: updated.etag,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        localVersion: localHash,
      },
    });

    logger.info('Auto-updated person on CardDAV', { personId: person.id });
  } catch (error) {
    logger.error('Auto-update failed', { error: error instanceof Error ? error.message : String(error) });

    // Update connection with error
    await prisma.cardDavConnection.update({
      where: { id: connection.id },
      data: {
        lastError: error instanceof Error ? error.message : 'Auto-update failed',
        lastErrorAt: new Date(),
      },
    });

    throw error;
  }
}
