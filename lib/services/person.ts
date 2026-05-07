/**
 * Person service — centralised create / update / delete / restore / merge logic.
 *
 * HTTP concerns (auth, validation, billing, photo upload) stay in the route
 * layer.  This module handles only the Prisma writes and CardDAV side-effects.
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma, withDeleted } from '@/lib/prisma';
import { createPersonSchema, updatePersonSchema } from '@/lib/validations';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { autoExportPerson, autoUpdatePerson } from '@/lib/carddav/auto-export';
import { personUpdateInclude, personDetailsInclude } from '@/lib/prisma-queries';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('person-service');

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type PersonInput = z.infer<typeof createPersonSchema>;
export type PersonUpdateInput = z.infer<typeof updatePersonSchema>;

/** Scalar field overrides accepted by mergePeople. */
export type MergeOverrides = {
  name?: string;
  surname?: string | null;
  middleName?: string | null;
  secondLastName?: string | null;
  nickname?: string | null;
  prefix?: string | null;
  suffix?: string | null;
  organization?: string | null;
  jobTitle?: string | null;
  gender?: string | null;
  photo?: string | null;
  notes?: string | null;
  anniversary?: string | null;
  lastContact?: string | null;
  relationshipToUserId?: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an importantDate input to the Prisma create shape. */
function mapImportantDate(date: NonNullable<PersonInput['importantDates']>[number]) {
  const dateValue = date.yearUnknown
    ? (() => {
        const d = new Date(date.date);
        d.setFullYear(1604);
        return d;
      })()
    : new Date(date.date);

  return {
    title: date.title,
    type: date.type ?? null,
    date: dateValue,
    reminderEnabled: date.reminderEnabled ?? false,
    reminderType: date.reminderEnabled ? date.reminderType : null,
    reminderInterval:
      date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderInterval : null,
    reminderIntervalUnit:
      date.reminderEnabled && date.reminderType === 'RECURRING' ? date.reminderIntervalUnit : null,
  };
}

// ---------------------------------------------------------------------------
// createPerson
// ---------------------------------------------------------------------------

/**
 * Create a new person with all nested writes and schedule CardDAV auto-export.
 *
 * Does NOT handle:
 * - Auth / session checks
 * - Billing limit checks
 * - Photo upload (call savePhoto in the route, then pass the filename)
 * - `connectedThroughId` relationship creation (route concern)
 */
export async function createPerson(userId: string, data: PersonInput) {
  const {
    name,
    surname,
    middleName,
    secondLastName,
    nickname,
    prefix,
    suffix,
    uid,
    organization,
    jobTitle,
    photo,
    gender,
    anniversary,
    lastContact,
    notes,
    relationshipToUserId,
    groupIds,
    importantDates,
    contactReminderEnabled,
    contactReminderInterval,
    contactReminderIntervalUnit,
    cardDavSyncEnabled,
    phoneNumbers,
    emails,
    addresses,
    urls,
    imHandles,
    locations,
    customFields,
  } = data;

  const sanitizedName = sanitizeName(name) || name;
  const sanitizedSurname = surname ? sanitizeName(surname) : null;
  const sanitizedMiddleName = middleName ? sanitizeName(middleName) : null;
  const sanitizedSecondLastName = secondLastName ? sanitizeName(secondLastName) : null;
  const sanitizedNickname = nickname ? sanitizeName(nickname) : null;
  const sanitizedNotes = notes ? sanitizeNotes(notes) : null;

  const person = await prisma.person.create({
    data: {
      user: { connect: { id: userId } },
      name: sanitizedName,
      surname: sanitizedSurname,
      middleName: sanitizedMiddleName,
      secondLastName: sanitizedSecondLastName,
      nickname: sanitizedNickname,
      prefix: prefix ?? null,
      suffix: suffix ?? null,
      uid: uid ?? null,
      organization: organization ?? null,
      jobTitle: jobTitle ?? null,
      photo: photo ?? null,
      gender: gender ?? null,
      anniversary: anniversary ? new Date(anniversary) : null,
      lastContact: lastContact ? new Date(lastContact) : null,
      notes: sanitizedNotes,
      contactReminderEnabled: contactReminderEnabled ?? false,
      contactReminderInterval: contactReminderEnabled ? contactReminderInterval : null,
      contactReminderIntervalUnit: contactReminderEnabled ? contactReminderIntervalUnit : null,
      cardDavSyncEnabled: cardDavSyncEnabled ?? true,
      groups: groupIds
        ? { create: groupIds.map((groupId) => ({ groupId })) }
        : undefined,
      importantDates:
        importantDates && importantDates.length > 0
          ? { create: importantDates.map(mapImportantDate) }
          : undefined,
      phoneNumbers:
        phoneNumbers && phoneNumbers.length > 0
          ? { create: phoneNumbers.map((p) => ({ type: p.type, number: p.number })) }
          : undefined,
      emails:
        emails && emails.length > 0
          ? { create: emails.map((e) => ({ type: e.type, email: e.email })) }
          : undefined,
      addresses:
        addresses && addresses.length > 0
          ? {
              create: addresses.map((a) => ({
                type: a.type,
                streetLine1: a.streetLine1 ?? null,
                streetLine2: a.streetLine2 ?? null,
                locality: a.locality ?? null,
                region: a.region ?? null,
                postalCode: a.postalCode ?? null,
                country: a.country ?? null,
              })),
            }
          : undefined,
      urls:
        urls && urls.length > 0
          ? { create: urls.map((u) => ({ type: u.type, url: u.url })) }
          : undefined,
      imHandles:
        imHandles && imHandles.length > 0
          ? { create: imHandles.map((im) => ({ protocol: im.protocol, handle: im.handle })) }
          : undefined,
      locations:
        locations && locations.length > 0
          ? {
              create: locations.map((loc) => ({
                type: loc.type,
                latitude: loc.latitude,
                longitude: loc.longitude,
              })),
            }
          : undefined,
      customFields:
        customFields && customFields.length > 0
          ? {
              create: customFields.map((f) => ({
                key: f.key,
                value: f.value,
                type: f.type ?? null,
              })),
            }
          : undefined,
      relationshipToUser:
        relationshipToUserId ? { connect: { id: relationshipToUserId } } : undefined,
    },
    include: personDetailsInclude(),
  });

  // Auto-export to CardDAV (background, non-blocking)
  if (cardDavSyncEnabled !== false) {
    autoExportPerson(person.id).catch((error: unknown) => {
      log.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          personId: person.id,
        },
        'Auto-export failed',
      );
    });
  }

  return person;
}

// ---------------------------------------------------------------------------
// updatePerson
// ---------------------------------------------------------------------------

/**
 * Update a person.  Only fields present in `data` are written.
 * Multi-value relations use the deleteMany + create pattern.
 *
 * Does NOT handle:
 * - Auth / session checks
 * - Billing limit checks
 * - Photo upload (pass the filename in `data.photo`)
 */
export async function updatePerson(id: string, userId: string, data: PersonUpdateInput) {
  // Verify ownership
  const existingPerson = await prisma.person.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existingPerson) {
    return null;
  }

  const {
    name,
    surname,
    middleName,
    secondLastName,
    nickname,
    prefix,
    suffix,
    uid,
    organization,
    jobTitle,
    photo,
    gender,
    anniversary,
    lastContact,
    notes,
    relationshipToUserId,
    groupIds,
    importantDates,
    contactReminderEnabled,
    contactReminderInterval,
    contactReminderIntervalUnit,
    cardDavSyncEnabled,
    phoneNumbers,
    emails,
    addresses,
    urls,
    imHandles,
    locations,
    customFields,
  } = data;

  const sanitizedName = name !== undefined ? sanitizeName(name) || name : undefined;
  const sanitizedSurname = surname !== undefined ? (surname ? sanitizeName(surname) : null) : undefined;
  const sanitizedMiddleName = middleName !== undefined ? (middleName ? sanitizeName(middleName) : null) : undefined;
  const sanitizedSecondLastName = secondLastName !== undefined ? (secondLastName ? sanitizeName(secondLastName) : null) : undefined;
  const sanitizedNickname = nickname !== undefined ? (nickname ? sanitizeName(nickname) : null) : undefined;
  const sanitizedNotes = notes !== undefined ? (notes ? sanitizeNotes(notes) : null) : undefined;

  const updateData: Prisma.PersonUpdateInput = {};

  if (name !== undefined) updateData.name = sanitizedName;
  if (surname !== undefined) updateData.surname = sanitizedSurname;
  if (middleName !== undefined) updateData.middleName = sanitizedMiddleName;
  if (secondLastName !== undefined) updateData.secondLastName = sanitizedSecondLastName;
  if (nickname !== undefined) updateData.nickname = sanitizedNickname;
  if (prefix !== undefined) updateData.prefix = prefix ?? null;
  if (suffix !== undefined) updateData.suffix = suffix ?? null;
  if (uid !== undefined) updateData.uid = uid ?? null;
  if (organization !== undefined) updateData.organization = organization ?? null;
  if (jobTitle !== undefined) updateData.jobTitle = jobTitle ?? null;
  if (photo !== undefined) updateData.photo = photo ?? null;
  if (gender !== undefined) updateData.gender = gender ?? null;
  if (anniversary !== undefined) updateData.anniversary = anniversary ? new Date(anniversary) : null;
  if (lastContact !== undefined) updateData.lastContact = lastContact ? new Date(lastContact) : null;
  if (notes !== undefined) updateData.notes = sanitizedNotes;

  if (contactReminderEnabled !== undefined) {
    updateData.contactReminderEnabled = contactReminderEnabled;
    updateData.contactReminderInterval = contactReminderEnabled ? contactReminderInterval : null;
    updateData.contactReminderIntervalUnit = contactReminderEnabled ? contactReminderIntervalUnit : null;
  }

  if (cardDavSyncEnabled !== undefined) {
    updateData.cardDavSyncEnabled = cardDavSyncEnabled;
  }

  if (groupIds !== undefined) {
    updateData.groups = {
      deleteMany: {},
      create: groupIds.map((groupId) => ({ groupId })),
    };
  }

  if (importantDates !== undefined) {
    updateData.importantDates = {
      deleteMany: {},
      create: importantDates.map(mapImportantDate),
    };
  }

  if (phoneNumbers !== undefined) {
    updateData.phoneNumbers = {
      deleteMany: {},
      create: phoneNumbers.map((p) => ({ type: p.type, number: p.number })),
    };
  }

  if (emails !== undefined) {
    updateData.emails = {
      deleteMany: {},
      create: emails.map((e) => ({ type: e.type, email: e.email })),
    };
  }

  if (addresses !== undefined) {
    updateData.addresses = {
      deleteMany: {},
      create: addresses.map((a) => ({
        type: a.type,
        streetLine1: a.streetLine1 ?? null,
        streetLine2: a.streetLine2 ?? null,
        locality: a.locality ?? null,
        region: a.region ?? null,
        postalCode: a.postalCode ?? null,
        country: a.country ?? null,
      })),
    };
  }

  if (urls !== undefined) {
    updateData.urls = {
      deleteMany: {},
      create: urls.map((u) => ({ type: u.type, url: u.url })),
    };
  }

  if (imHandles !== undefined) {
    updateData.imHandles = {
      deleteMany: {},
      create: imHandles.map((im) => ({ protocol: im.protocol, handle: im.handle })),
    };
  }

  if (locations !== undefined) {
    updateData.locations = {
      deleteMany: {},
      create: locations.map((loc) => ({
        type: loc.type,
        latitude: loc.latitude,
        longitude: loc.longitude,
      })),
    };
  }

  if (customFields !== undefined) {
    updateData.customFields = {
      deleteMany: {},
      create: customFields.map((f) => ({
        key: f.key,
        value: f.value,
        type: f.type ?? null,
      })),
    };
  }

  if (relationshipToUserId !== undefined) {
    updateData.relationshipToUser = relationshipToUserId
      ? { connect: { id: relationshipToUserId } }
      : { disconnect: true };
  }

  const person = await prisma.person.update({
    where: { id },
    data: updateData,
    include: personUpdateInclude(),
  });

  // CardDAV sync — use stored value as default when input doesn't specify
  const shouldSync = cardDavSyncEnabled ?? existingPerson.cardDavSyncEnabled;
  if (shouldSync !== false) {
    autoUpdatePerson(person.id).catch((error: unknown) => {
      log.error(
        {
          err: error instanceof Error ? error : new Error(String(error)),
          personId: person.id,
        },
        'Auto-update failed',
      );
    });
  }

  return person;
}

// ---------------------------------------------------------------------------
// deletePerson
// ---------------------------------------------------------------------------

/**
 * Soft-delete a person (sets deletedAt).
 *
 * Returns the deleted person's id, or null if not found / not owned.
 */
export async function deletePerson(id: string, userId: string): Promise<string | null> {
  const existingPerson = await prisma.person.findUnique({
    where: { id, userId, deletedAt: null },
  });

  if (!existingPerson) {
    return null;
  }

  // Delete CardDAV mapping so the contact can be re-imported if it still exists on server
  await prisma.cardDavMapping.deleteMany({
    where: { personId: id },
  });

  await prisma.person.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return id;
}

// ---------------------------------------------------------------------------
// restorePerson
// ---------------------------------------------------------------------------

/**
 * Restore a soft-deleted person (clears deletedAt).
 *
 * Returns the restored person's id, or null if not found / not owned.
 */
export async function restorePerson(id: string, userId: string): Promise<string | null> {
  const rawPrisma = withDeleted();

  try {
    const existingPerson = await rawPrisma.person.findUnique({
      where: { id, userId },
    });

    if (!existingPerson || existingPerson.deletedAt === null) {
      return null;
    }

    await rawPrisma.person.update({
      where: { id },
      data: { deletedAt: null },
    });

    return id;
  } finally {
    await rawPrisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// mergePeople
// ---------------------------------------------------------------------------

const SCALAR_STRING_FIELDS = [
  'name', 'surname', 'middleName', 'secondLastName', 'nickname',
  'prefix', 'suffix', 'organization', 'jobTitle', 'gender', 'photo', 'notes',
] as const;

type ScalarStringField = typeof SCALAR_STRING_FIELDS[number];

/** Full include used when fetching people for merge. */
const mergeFullInclude = {
  groups: true,
  relationshipsFrom: { where: { deletedAt: null } },
  relationshipsTo: { where: { deletedAt: null } },
  phoneNumbers: true,
  emails: true,
  addresses: true,
  urls: true,
  imHandles: true,
  locations: true,
  customFields: true,
  customFieldValues: true,
  importantDates: true,
} as const;

/**
 * Merge `sourceId` into `targetId` in a single transaction.
 * The source is soft-deleted after the merge.
 *
 * Returns the targetId, or null if either person is not found / not owned.
 */
export async function mergePeople(
  targetId: string,
  sourceId: string,
  userId: string,
  overrides?: MergeOverrides,
): Promise<string | null> {
  const [target, source] = await Promise.all([
    prisma.person.findUnique({
      where: { id: targetId, userId, deletedAt: null },
      include: mergeFullInclude,
    }),
    prisma.person.findUnique({
      where: { id: sourceId, userId, deletedAt: null },
      include: mergeFullInclude,
    }),
  ]);

  if (!target || !source) {
    return null;
  }

  // Build scalar updates from overrides + auto-transfer empty fields
  const scalarUpdates: Prisma.PersonUpdateInput = {};

  if (overrides) {
    for (const field of SCALAR_STRING_FIELDS) {
      if (field in overrides) {
        (scalarUpdates as Record<string, unknown>)[field] = overrides[field as ScalarStringField];
      }
    }
    if ('anniversary' in overrides) {
      scalarUpdates.anniversary = overrides.anniversary ? new Date(overrides.anniversary) : null;
    }
    if ('lastContact' in overrides) {
      scalarUpdates.lastContact = overrides.lastContact ? new Date(overrides.lastContact) : null;
    }
    if ('relationshipToUserId' in overrides) {
      scalarUpdates.relationshipToUser = overrides.relationshipToUserId
        ? { connect: { id: overrides.relationshipToUserId } }
        : { disconnect: true };
    }
  }

  // Auto-transfer scalar fields that are empty on target
  for (const field of SCALAR_STRING_FIELDS) {
    if (!(field in scalarUpdates) && !target[field] && source[field]) {
      scalarUpdates[field] = source[field];
    }
  }
  for (const dateField of ['anniversary', 'lastContact'] as const) {
    if (!(dateField in scalarUpdates) && !target[dateField] && source[dateField]) {
      scalarUpdates[dateField] = source[dateField];
    }
  }
  if (!('relationshipToUser' in scalarUpdates) && !target.relationshipToUserId && source.relationshipToUserId) {
    scalarUpdates.relationshipToUser = { connect: { id: source.relationshipToUserId } };
  }

  // Determine groups to add
  const targetGroupIds = new Set(target.groups.map((g) => g.groupId));
  const newGroupIds = source.groups
    .filter((g) => !targetGroupIds.has(g.groupId))
    .map((g) => g.groupId);

  // Deduplicate multi-value fields
  const targetPhones = new Set(target.phoneNumbers.map((p) => p.number));
  const targetEmails = new Set(target.emails.map((e) => e.email.toLowerCase()));
  const targetUrls = new Set(target.urls.map((u) => u.url.toLowerCase()));
  const targetImHandles = new Set(target.imHandles.map((im) => `${im.protocol}:${im.handle}`.toLowerCase()));
  const targetAddresses = new Set(
    target.addresses.map((a) =>
      [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country]
        .map((v) => (v ?? '').toLowerCase().trim())
        .join('|')
    )
  );
  const targetLocations = new Set(target.locations.map((l) => `${l.latitude},${l.longitude}`));
  const targetCustomFields = new Set(target.customFields.map((f) => `${f.key}:${f.value}`));
  const targetTemplateIds = new Set(
    target.customFieldValues?.map((v) => v.templateId) ?? []
  );
  const targetImportantDates = new Set(
    target.importantDates.map((d) =>
      `${d.title}:${d.date instanceof Date ? d.date.toISOString() : d.date}`
    )
  );

  const phonesToTransfer = source.phoneNumbers.filter((p) => !targetPhones.has(p.number));
  const emailsToTransfer = source.emails.filter((e) => !targetEmails.has(e.email.toLowerCase()));
  const urlsToTransfer = source.urls.filter((u) => !targetUrls.has(u.url.toLowerCase()));
  const imHandlesToTransfer = source.imHandles.filter(
    (im) => !targetImHandles.has(`${im.protocol}:${im.handle}`.toLowerCase())
  );
  const addressesToTransfer = source.addresses.filter((a) => {
    const key = [a.streetLine1, a.streetLine2, a.locality, a.region, a.postalCode, a.country]
      .map((v) => (v ?? '').toLowerCase().trim())
      .join('|');
    return !targetAddresses.has(key);
  });
  const locationsToTransfer = source.locations.filter(
    (l) => !targetLocations.has(`${l.latitude},${l.longitude}`)
  );
  const customFieldsToTransfer = source.customFields.filter(
    (f) => !targetCustomFields.has(`${f.key}:${f.value}`)
  );
  const customFieldValuesToTransfer = (source.customFieldValues ?? []).filter(
    (v) => !targetTemplateIds.has(v.templateId)
  );
  const importantDatesToTransfer = source.importantDates.filter((d) => {
    const key = `${d.title}:${d.date instanceof Date ? d.date.toISOString() : d.date}`;
    return !targetImportantDates.has(key);
  });

  // Determine relationships to re-parent
  const targetRelatedFromIds = new Set(target.relationshipsFrom.map((r) => r.relatedPersonId));
  const targetRelatedToIds = new Set(target.relationshipsTo.map((r) => r.personId));

  const relsFromToTransfer = source.relationshipsFrom.filter((r) => {
    if (r.relatedPersonId === targetId) return false;
    if (targetRelatedFromIds.has(r.relatedPersonId)) return false;
    return true;
  });

  const relsToToTransfer = source.relationshipsTo.filter((r) => {
    if (r.personId === targetId) return false;
    if (targetRelatedToIds.has(r.personId)) return false;
    return true;
  });

  const transferredRelIds = new Set([
    ...relsFromToTransfer.map((r) => r.id),
    ...relsToToTransfer.map((r) => r.id),
  ]);

  const leftoverRelIds = [
    ...source.relationshipsFrom.map((r) => r.id),
    ...source.relationshipsTo.map((r) => r.id),
  ].filter((relId) => !transferredRelIds.has(relId));

  await prisma.$transaction(async (tx) => {
    // (a) Apply scalar updates
    if (Object.keys(scalarUpdates).length > 0) {
      await tx.person.update({ where: { id: targetId }, data: scalarUpdates });
    }

    // (b) Transfer multi-value fields (re-parent non-duplicates, cleanup rest)
    type MultiValueOp = {
      items: Array<{ id: string }>;
      transfer: (ids: string[]) => Promise<unknown>;
      cleanup: () => Promise<unknown>;
    };

    const multiValueOps: MultiValueOp[] = [
      {
        items: phonesToTransfer,
        transfer: (ids) => tx.personPhone.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personPhone.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: emailsToTransfer,
        transfer: (ids) => tx.personEmail.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personEmail.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: addressesToTransfer,
        transfer: (ids) => tx.personAddress.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personAddress.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: urlsToTransfer,
        transfer: (ids) => tx.personUrl.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personUrl.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: imHandlesToTransfer,
        transfer: (ids) => tx.personIM.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personIM.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: locationsToTransfer,
        transfer: (ids) => tx.personLocation.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personLocation.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: customFieldsToTransfer,
        transfer: (ids) => tx.personCustomField.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personCustomField.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: customFieldValuesToTransfer,
        transfer: (ids) => tx.personCustomFieldValue.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.personCustomFieldValue.deleteMany({ where: { personId: sourceId } }),
      },
      {
        items: importantDatesToTransfer,
        transfer: (ids) => tx.importantDate.updateMany({ where: { id: { in: ids } }, data: { personId: targetId } }),
        cleanup: () => tx.importantDate.deleteMany({ where: { personId: sourceId } }),
      },
    ];

    for (const { items, transfer } of multiValueOps) {
      if (items.length > 0) {
        await transfer(items.map((x) => x.id));
      }
    }

    // (c) Transfer groups
    if (newGroupIds.length > 0) {
      await tx.personGroup.createMany({
        data: newGroupIds.map((groupId) => ({ personId: targetId, groupId })),
      });
    }

    // (d) Re-parent relationships
    if (relsFromToTransfer.length > 0) {
      await tx.relationship.updateMany({
        where: { id: { in: relsFromToTransfer.map((r) => r.id) } },
        data: { personId: targetId },
      });
    }
    if (relsToToTransfer.length > 0) {
      await tx.relationship.updateMany({
        where: { id: { in: relsToToTransfer.map((r) => r.id) } },
        data: { relatedPersonId: targetId },
      });
    }

    // (d2) Re-parent journal entry references; remove any that would collide
    // with an existing target reference (the join has @@unique on
    // [journalEntryId, personId]). Without this step, the source's join rows
    // remain pointing at a soft-deleted person and disappear from the journal
    // UI, which filters out people with deletedAt set.
    const targetJournalRefs = await tx.journalEntryPerson.findMany({
      where: { personId: targetId },
      select: { journalEntryId: true },
    });
    const targetJournalEntryIds = targetJournalRefs.map((r) => r.journalEntryId);

    if (targetJournalEntryIds.length > 0) {
      await tx.journalEntryPerson.deleteMany({
        where: {
          personId: sourceId,
          journalEntryId: { in: targetJournalEntryIds },
        },
      });
    }

    await tx.journalEntryPerson.updateMany({
      where: { personId: sourceId },
      data: { personId: targetId },
    });

    // (e) Delete source's CardDAV mapping
    await tx.cardDavMapping.deleteMany({ where: { personId: sourceId } });

    // (f) Delete source's remaining group memberships
    await tx.personGroup.deleteMany({ where: { personId: sourceId } });

    // Soft-delete leftover self-referential relationships
    if (leftoverRelIds.length > 0) {
      await tx.relationship.updateMany({
        where: { id: { in: leftoverRelIds } },
        data: { deletedAt: new Date() },
      });
    }

    // Cleanup remaining source multi-value records
    for (const { cleanup } of multiValueOps) {
      await cleanup();
    }

    // (g) Soft-delete the source
    await tx.person.update({
      where: { id: sourceId },
      data: { deletedAt: new Date() },
    });
  });

  log.info({ targetId, sourceId, userId }, 'Successfully merged contacts');

  return targetId;
}
