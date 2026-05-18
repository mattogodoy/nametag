/**
 * vCard import utilities
 * Converts vCard data into Nametag Person model records
 *
 * Combines:
 * - lib/carddav/person-from-vcard.ts (DB write helpers)
 * - vCardToPerson from lib/vcard.ts (parser wrapper)
 */

import { prisma } from '@/lib/prisma';
import { savePhoto } from '@/lib/photo-storage';
import type { ParsedVCardData } from './types';
import type { Person } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { parseVCard } from './vcard-parser';

// Derive the transaction client type from our actual (extended) prisma instance.
// Parameters<...>[0] extracts the callback arg of $transaction, then
// Parameters<callback>[0] is the `tx` client it receives.
type TransactionCallback = Parameters<typeof prisma.$transaction>[0];
type TxClient = TransactionCallback extends (tx: infer T) => unknown ? T : never;

/**
 * Parse vCard string to Person data structure
 * Uses the enhanced parser which handles both v3.0 and v4.0, vendor extensions, etc.
 */
export function vCardToPerson(vCardText: string): ParsedVCardData {
  return parseVCard(vCardText);
}

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
            type: date.type ?? null,
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
            type: date.type ?? null,
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
 *
 * When `skipNameFields` is true, name-related fields (name, surname,
 * middleName, secondLastName, prefix, suffix) are returned as `undefined`
 * so Prisma leaves the existing DB values intact. This is used during
 * import when a non-FULL cardDavNameFormat or per-contact display-name
 * override is active: the N field in the vCard contains the display name
 * (e.g., "Mom") rather than the real name ("Maria"), so importing it
 * would overwrite real names in the database.
 */
export function buildScalarPersonData(parsedData: ParsedVCardData, skipNameFields = false) {
  // Use `?? null` for optional fields so Prisma clears them when absent from
  // the vCard.  Plain `undefined` would cause Prisma to skip the field entirely,
  // preserving a stale value after the remote side deleted it.
  return {
    name: skipNameFields ? undefined : parsedData.name,
    surname: skipNameFields ? undefined : (parsedData.surname ?? null),
    secondLastName: skipNameFields ? undefined : (parsedData.secondLastName ?? null),
    middleName: skipNameFields ? undefined : (parsedData.middleName ?? null),
    prefix: skipNameFields ? undefined : (parsedData.prefix ?? null),
    suffix: skipNameFields ? undefined : (parsedData.suffix ?? null),
    nickname: parsedData.nickname ?? null,
    organization: parsedData.organization ?? null,
    jobTitle: parsedData.jobTitle ?? null,
    photo: parsedData.photo,
    gender: parsedData.gender ?? null,
    anniversary: parsedData.anniversary ?? null,
    lastContact: parsedData.lastContact ?? null,
    notes: parsedData.notes ?? null,
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
  options?: { skipNameFields?: boolean },
): Promise<void> {
  // Save photo as file if present (outside transaction since it's filesystem I/O).
  // When the remote vCard has no PHOTO field (undefined), preserve the local photo
  // rather than clearing it. Many CardDAV servers strip photos from vCards.
  let photoDbValue: string | undefined;
  if (parsedData.photo) {
    const filename = await savePhoto(userId, personId, parsedData.photo);
    photoDbValue = filename ?? parsedData.photo;
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
        ...buildScalarPersonData(parsedData, options?.skipNameFields),
        photo: photoDbValue,
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
          ? { create: parsedData.importantDates.map((date) => ({
              type: date.type ?? null,
              title: date.title,
              date: date.date,
              reminderEnabled: false,
            })) }
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
  options?: { skipNameFields?: boolean },
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
      ...buildScalarPersonData(parsedData, options?.skipNameFields),
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
        ? { create: parsedData.importantDates.map((date) => ({
            type: date.type ?? null,
            title: date.title,
            date: date.date,
            reminderEnabled: false,
          })) }
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
