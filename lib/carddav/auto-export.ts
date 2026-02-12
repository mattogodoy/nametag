import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { personToVCard } from '@/lib/vcard';
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

    // Ensure person has a UID
    const uid: string = person.uid || uuidv4();
    if (!person.uid) {
      await prisma.person.update({
        where: { id: person.id },
        data: { uid },
      });
    }

    // Convert to vCard
    const vCardData = personToVCard(person);

    // Create vCard on server
    const filename = `${uid}.vcf`;
    const created = await client.createVCard(addressBook, vCardData, filename);

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

    console.log(`Auto-exported person ${person.id} to CardDAV`);
  } catch (error) {
    console.error('Auto-export failed:', error);

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

  if (!connection || !connection.syncEnabled || !connection.autoExportNew) {
    // Auto-update not enabled, skip
    return;
  }

  // Get mapping
  const mapping = await prisma.cardDavMapping.findUnique({
    where: { personId: person.id },
  });

  if (!mapping) {
    // Not exported yet, try auto-export
    await autoExportPerson(personId);
    return;
  }

  try {
    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Convert to vCard
    const vCardData = personToVCard(person);

    // Update vCard on server
    const vCard = {
      url: mapping.href,
      etag: mapping.etag || '',
      data: '',
    };

    const updated = await client.updateVCard(vCard, vCardData);

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
        lastLocalChange: new Date(),
        localVersion: localHash,
      },
    });

    console.log(`Auto-updated person ${person.id} on CardDAV`);
  } catch (error) {
    console.error('Auto-update failed:', error);

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
