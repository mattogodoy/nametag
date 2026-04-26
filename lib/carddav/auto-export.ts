import { prisma } from '@/lib/prisma';
import { createCardDavClient } from './client';
import { getAddressBook } from './address-book';
import { personToVCard } from '@/lib/carddav/vcard-export';
import { readPhotoForExport, isPhotoFilename } from '@/lib/photo-storage';
import { withRetry } from './retry';
import { classifyUpdateFailure } from './update-recovery';
import { buildLocalHash } from './hash';
import { createModuleLogger } from '@/lib/logger';
import { ExternalServiceError } from '@/lib/errors';
import { updateContext } from '@/lib/logging/context';

const log = createModuleLogger('carddav');
import { v4 as uuidv4 } from 'uuid';

/**
 * Build formatted full name matching vCard FN field construction.
 * Must match the logic in lib/vcard.ts formatFullName().
 */
function formatExportFullName(person: {
  name: string | null;
  surname: string | null;
  middleName: string | null;
  prefix: string | null;
  suffix: string | null;
  secondLastName: string | null;
  nickname: string | null;
}): string {
  const parts: string[] = [];
  if (person.prefix) parts.push(person.prefix);
  if (person.name) parts.push(person.name);
  if (person.middleName) parts.push(person.middleName);
  if (person.surname) parts.push(person.surname);
  if (person.secondLastName) parts.push(person.secondLastName);
  if (person.suffix) parts.push(person.suffix);
  if (person.nickname && parts.length === 0) parts.push(person.nickname);
  return parts.join(' ') || 'Unknown';
}

/**
 * Auto-export a person to CardDAV server
 */
export async function autoExportPerson(personId: string): Promise<void> {
  // Get person with all relations
  const person = await prisma.person.findUnique({
    where: { id: personId, deletedAt: null },
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
        where: { deletedAt: null },
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

  // Abort if person was soft-deleted (race condition with merge)
  if (person.deletedAt) {
    log.info({ personId: person.id }, 'Skipping auto-export for soft-deleted person');
    return;
  }

  if (!person.cardDavSyncEnabled) {
    return;
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
    updateContext({ personId: person.id });
    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Get address book
    const addressBook = await getAddressBook(client, connection);

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

    // Re-check person hasn't been soft-deleted during export (race condition with merge)
    const freshPerson = await prisma.person.findUnique({
      where: { id: person.id },
      select: { deletedAt: true },
    });
    if (freshPerson?.deletedAt) {
      log.info({ personId: person.id }, 'Person soft-deleted during auto-export, cleaning up vCard');
      try {
        await client.deleteVCard({ url: created.url, etag: created.etag, data: '' });
      } catch (cleanupErr) {
        log.warn({ err: cleanupErr instanceof Error ? cleanupErr : new Error(String(cleanupErr)) },
          'Failed to clean up orphaned vCard');
      }
      return;
    }

    // Some providers (e.g. Google Contacts) rewrite the URL and UID of created
    // vCards. Re-fetch from the server to get the actual values so our mapping
    // points to the real resource and future deletes/updates work correctly.
    let actualUrl = created.url;
    let actualEtag = created.etag;
    let actualUid = uid;

    try {
      const serverVCards = await client.fetchVCards(addressBook);
      const fullName = formatExportFullName(person);

      // Get all hrefs already tracked in our DB so we don't accidentally
      // match an existing contact with the same name.
      const existingHrefs = new Set(
        (await prisma.cardDavMapping.findMany({
          where: { connectionId: connection.id },
          select: { href: true },
        })).map((m) => m.href)
      );

      const match = serverVCards.find((vc) => {
        if (existingHrefs.has(vc.url)) return false;
        const fnMatch = vc.data.match(/^FN[^:]*:(.+)$/mi);
        return fnMatch && fnMatch[1].trim() === fullName;
      });

      if (match) {
        actualUrl = match.url;
        actualEtag = match.etag;
        const uidMatch = match.data.match(/^UID[^:]*:(.+)$/mi);
        if (uidMatch) actualUid = uidMatch[1].trim();
        log.info(
          { personId: person.id, putUrl: created.url, actualUrl: match.url },
          'Server assigned different URL for vCard, using actual URL'
        );
      }
    } catch (refetchErr) {
      log.warn(
        { err: refetchErr instanceof Error ? refetchErr : new Error(String(refetchErr)) },
        'Failed to re-fetch vCard after creation, using PUT response URL'
      );
    }

    // Create mapping with the actual server-assigned URL/UID
    const localHash = buildLocalHash(person);

    await prisma.cardDavMapping.create({
      data: {
        connectionId: connection.id,
        personId: person.id,
        uid: actualUid,
        href: actualUrl,
        etag: actualEtag,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        localVersion: localHash,
      },
    });

    log.info({ personId: person.id }, 'Auto-exported person to CardDAV');
  } catch (error) {
    log.error(
      {
        event: 'carddav.autoExport.failed',
        personId: person.id,
        err: error instanceof Error ? error : new Error(String(error)),
      },
      'CardDAV auto-export failed',
    );

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
    where: { id: personId, deletedAt: null },
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
        where: { deletedAt: null },
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

  if (!person.cardDavSyncEnabled) {
    return;
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
    updateContext({ personId: person.id });
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
    let vCard = {
      url: mapping.href,
      etag: mapping.etag || '',
      data: '',
    };

    let updated;
    try {
      updated = await withRetry(() => client.updateVCard(vCard, vCardData));
    } catch (updateError) {
      const isRecoverableStatus =
        updateError instanceof ExternalServiceError &&
        (updateError.status === 400 || updateError.status === 404 || updateError.status === 410);
      if (!isRecoverableStatus) throw updateError;

      // Disambiguate via GET. See update-recovery.ts for the rationale.
      const addressBook = await getAddressBook(client, connection);
      const recovery = await classifyUpdateFailure(client, addressBook, mapping.href, vCard.etag);

      if (recovery.kind === 'gone') {
        log.warn(
          { event: 'carddav.contact.gone', personId: person.id, href: mapping.href },
          'CardDAV resource gone server-side; resetting mapping so next push creates a fresh contact',
        );
        await prisma.cardDavMapping.delete({ where: { id: mapping.id } });
        await prisma.person.update({
          where: { id: person.id },
          data: { uid: null },
        });
        return;
      }

      if (recovery.kind === 'stale-etag') {
        log.warn(
          { personId: person.id, href: mapping.href },
          'Server returned a non-412 status with a moved ETag; refreshing and retrying',
        );
        vCard = { url: mapping.href, etag: recovery.freshEtag, data: '' };
        updated = await client.updateVCard(vCard, vCardData);
      } else {
        throw updateError;
      }
    }

    // Update mapping
    const localHash = buildLocalHash(person);

    await prisma.cardDavMapping.update({
      where: { id: mapping.id },
      data: {
        etag: updated.etag,
        syncStatus: 'synced',
        lastSyncedAt: new Date(),
        localVersion: localHash,
      },
    });

    log.info({ personId: person.id }, 'Auto-updated person on CardDAV');
  } catch (error) {
    log.error(
      {
        event: 'carddav.autoUpdate.failed',
        personId: person.id,
        err: error instanceof Error ? error : new Error(String(error)),
      },
      'CardDAV auto-update failed',
    );

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
