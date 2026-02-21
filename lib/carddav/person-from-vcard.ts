/**
 * Shared helpers for creating/updating a Person from parsed vCard data.
 *
 * These functions centralise the logic that was previously duplicated across:
 *   - app/api/carddav/import/route.ts
 *   - app/api/vcard/import/route.ts
 *   - app/api/carddav/conflicts/[id]/resolve/route.ts
 *   - lib/carddav/sync.ts (updatePersonFromVCard)
 */

import { prisma } from '@/lib/prisma';
import { savePhoto } from '@/lib/photo-storage';
import type { ParsedVCardData } from './types';
import type { Person } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// Derive the transaction client type from our actual (extended) prisma instance.
// Parameters<...>[0] extracts the callback arg of $transaction, then
// Parameters<callback>[0] is the `tx` client it receives.
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TxClient = TransactionCallback extends (tx: infer T) => unknown ? T : never;

/**
 * Build the Prisma data object for multi-value fields when *creating* a person.
 * Uses nested `create` so everything is inserted in a single Prisma call.
 */
function buildMultiValueCreateData(parsedData: ParsedVCardData) {
  return {
    phoneNumbers: parsedData.phoneNumbers?.length
      ? { create: parsedData.phoneNumbers }
      : undefined,
    emails: parsedData.emails?.length
      ? { create: parsedData.emails }
      : undefined,
    addresses: parsedData.addresses?.length
      ? { create: parsedData.addresses }
      : undefined,
    urls: parsedData.urls?.length
      ? { create: parsedData.urls }
      : undefined,
    imHandles: parsedData.imHandles?.length
      ? { create: parsedData.imHandles }
      : undefined,
    locations: parsedData.locations?.length
      ? { create: parsedData.locations }
      : undefined,
    customFields: parsedData.customFields?.length
      ? { create: parsedData.customFields }
      : undefined,
    importantDates: parsedData.importantDates?.length
      ? {
          create: parsedData.importantDates.map((date) => ({
            title: date.title,
            date: date.date,
            reminderEnabled: false,
          })),
        }
      : undefined,
  };
}

/**
 * Build the Prisma data object for multi-value fields when *updating* an
 * existing person. Uses `deleteMany` + `create` to replace all values.
 */
function buildMultiValueUpdateData(parsedData: ParsedVCardData) {
  return {
    phoneNumbers: parsedData.phoneNumbers
      ? { deleteMany: {}, create: parsedData.phoneNumbers }
      : undefined,
    emails: parsedData.emails
      ? { deleteMany: {}, create: parsedData.emails }
      : undefined,
    addresses: parsedData.addresses
      ? { deleteMany: {}, create: parsedData.addresses }
      : undefined,
    urls: parsedData.urls
      ? { deleteMany: {}, create: parsedData.urls }
      : undefined,
    imHandles: parsedData.imHandles
      ? { deleteMany: {}, create: parsedData.imHandles }
      : undefined,
    locations: parsedData.locations
      ? { deleteMany: {}, create: parsedData.locations }
      : undefined,
    customFields: parsedData.customFields
      ? { deleteMany: {}, create: parsedData.customFields }
      : undefined,
    importantDates: parsedData.importantDates
      ? {
          deleteMany: {},
          create: parsedData.importantDates.map((date) => ({
            title: date.title,
            date: date.date,
            reminderEnabled: false,
          })),
        }
      : undefined,
  };
}

/**
 * Scalar person fields derived from parsed vCard data.
 */
function buildScalarPersonData(parsedData: ParsedVCardData) {
  return {
    name: parsedData.name,
    surname: parsedData.surname,
    secondLastName: parsedData.secondLastName,
    middleName: parsedData.middleName,
    prefix: parsedData.prefix,
    suffix: parsedData.suffix,
    nickname: parsedData.nickname,
    organization: parsedData.organization,
    jobTitle: parsedData.jobTitle,
    photo: parsedData.photo,
    gender: parsedData.gender,
    anniversary: parsedData.anniversary,
    lastContact: parsedData.lastContact,
    notes: parsedData.notes,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a new Person from parsed vCard data and save their photo.
 *
 * Returns the newly-created Person record.
 */
export async function createPersonFromVCardData(
  userId: string,
  parsedData: ParsedVCardData,
): Promise<Person> {
  const person = await prisma.person.create({
    data: {
      userId,
      ...buildScalarPersonData(parsedData),
      name: parsedData.name || '',
      uid: parsedData.uid || uuidv4(),
      ...buildMultiValueCreateData(parsedData),
    },
  });

  // Save photo as a file (outside of the DB write)
  if (parsedData.photo && person.id) {
    const photoFilename = await savePhoto(userId, person.id, parsedData.photo);
    if (photoFilename) {
      await prisma.person.update({
        where: { id: person.id },
        data: { photo: photoFilename },
      });
    }
  }

  return person;
}

/**
 * Restore a soft-deleted Person and update it with fresh vCard data.
 *
 * Returns the restored Person record.
 */
export async function restorePersonFromVCardData(
  userId: string,
  softDeletedPersonId: string,
  parsedData: ParsedVCardData,
): Promise<Person> {
  const person = await prisma.person.update({
    where: { id: softDeletedPersonId },
    data: {
      deletedAt: null,
      ...buildScalarPersonData(parsedData),
      name: parsedData.name || '',
      uid: parsedData.uid,
      ...buildMultiValueUpdateData(parsedData),
    },
  });

  // Save photo as a file (outside of the DB write)
  if (parsedData.photo && person.id) {
    const photoFilename = await savePhoto(userId, person.id, parsedData.photo);
    if (photoFilename) {
      await prisma.person.update({
        where: { id: person.id },
        data: { photo: photoFilename },
      });
    }
  }

  return person;
}

/**
 * Update an existing Person from parsed vCard data.
 *
 * Uses a delete-all-then-recreate pattern for multi-value fields so the
 * database always reflects the latest vCard state. Also saves photo files.
 *
 * This was originally `updatePersonFromVCard` in `lib/carddav/sync.ts`.
 */
export async function updatePersonFromVCard(
  personId: string,
  parsedData: ParsedVCardData,
  userId: string,
): Promise<void> {
  // Save photo as file if present (outside transaction since it's filesystem I/O)
  let photoValue = parsedData.photo;
  if (photoValue) {
    const filename = await savePhoto(userId, personId, photoValue);
    if (filename) {
      photoValue = filename;
    }
    // If savePhoto fails, keep the original value as fallback
  }

  // Delete all multi-value fields and update person in a single atomic transaction
  // to prevent partial data loss if either step fails
  await prisma.$transaction(async (tx) => {
    await tx.personPhone.deleteMany({ where: { personId } });
    await tx.personEmail.deleteMany({ where: { personId } });
    await tx.personAddress.deleteMany({ where: { personId } });
    await tx.personUrl.deleteMany({ where: { personId } });
    await tx.personIM.deleteMany({ where: { personId } });
    await tx.personLocation.deleteMany({ where: { personId } });
    await tx.personCustomField.deleteMany({ where: { personId } });
    await tx.importantDate.deleteMany({ where: { personId } });

    await tx.person.update({
      where: { id: personId },
      data: {
        ...buildScalarPersonData(parsedData),
        photo: photoValue,
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
        importantDates: parsedData.importantDates?.length
          ? { create: parsedData.importantDates }
          : undefined,
      },
    });
  });
}

/**
 * Update an existing Person from parsed vCard data within an existing
 * Prisma interactive transaction.
 *
 * Used by conflict resolution where the update must be part of a larger
 * atomic transaction. Photo saving happens **after** the transaction commits
 * (caller is responsible for calling `savePhotoForPerson` separately).
 */
export async function updatePersonFromVCardInTransaction(
  tx: TxClient,
  personId: string,
  parsedData: ParsedVCardData,
): Promise<void> {
  // Delete all multi-value fields
  await tx.personPhone.deleteMany({ where: { personId } });
  await tx.personEmail.deleteMany({ where: { personId } });
  await tx.personAddress.deleteMany({ where: { personId } });
  await tx.personUrl.deleteMany({ where: { personId } });
  await tx.personIM.deleteMany({ where: { personId } });
  await tx.personLocation.deleteMany({ where: { personId } });
  await tx.personCustomField.deleteMany({ where: { personId } });
  await tx.importantDate.deleteMany({ where: { personId } });

  // Update person with remote data
  await tx.person.update({
    where: { id: personId },
    data: {
      ...buildScalarPersonData(parsedData),
      uid: parsedData.uid,

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
      importantDates: parsedData.importantDates?.length
        ? { create: parsedData.importantDates }
        : undefined,
    },
  });
}

/**
 * Save a photo for a person (useful after a transaction commits).
 */
export async function savePhotoForPerson(
  userId: string,
  personId: string,
  photoData: string,
): Promise<void> {
  const photoFilename = await savePhoto(userId, personId, photoData);
  if (photoFilename) {
    await prisma.person.update({
      where: { id: personId },
      data: { photo: photoFilename },
    });
  }
}
