import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, withDeleted } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/vcard';
import { savePhoto } from '@/lib/photo-storage';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { importIds, groupIds, globalGroupIds, perContactGroups } = body;

    // Support both old and new API formats
    const globalGroups = globalGroupIds || groupIds || [];
    const contactGroups = perContactGroups || {};

    if (!importIds || !Array.isArray(importIds) || importIds.length === 0) {
      return NextResponse.json(
        { error: 'No contacts selected for import' },
        { status: 400 }
      );
    }

    // Get connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'CardDAV connection not found' },
        { status: 404 }
      );
    }

    // Get pending imports
    const pendingImports = await prisma.cardDavPendingImport.findMany({
      where: {
        id: { in: importIds },
        connectionId: connection.id,
      },
    });

    if (pendingImports.length === 0) {
      return NextResponse.json(
        { error: 'No pending imports found' },
        { status: 404 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    };

    // Performance optimization: Fetch all soft-deleted persons with matching UIDs upfront
    // This prevents N+1 query problem when importing many contacts
    const allUIDs = pendingImports
      .map((p) => {
        try {
          return vCardToPerson(p.vCardData).uid;
        } catch {
          return null;
        }
      })
      .filter((uid): uid is string => Boolean(uid));

    // Use withDeleted() to bypass soft-delete filtering and find soft-deleted records
    const rawClient = withDeleted();
    let softDeletedPersons: Awaited<ReturnType<typeof rawClient.person.findMany>> = [];
    try {
      softDeletedPersons = allUIDs.length > 0
        ? await rawClient.person.findMany({
            where: {
              uid: { in: allUIDs },
              userId: session.user.id,
              deletedAt: { not: null },
            },
          })
        : [];
    } finally {
      await rawClient.$disconnect();
    }

    // Create a Map for O(1) lookup during import
    const softDeletedMap = new Map(
      softDeletedPersons.map((p) => [p.uid, p])
    );

    for (const pendingImport of pendingImports) {
      try {
        // Parse vCard
        const parsedData = vCardToPerson(pendingImport.vCardData);

        // Sanitize imported data to prevent XSS attacks
        parsedData.name = sanitizeName(parsedData.name) || parsedData.name;
        parsedData.surname = parsedData.surname ? sanitizeName(parsedData.surname) ?? parsedData.surname : parsedData.surname;
        parsedData.middleName = parsedData.middleName ? sanitizeName(parsedData.middleName) ?? parsedData.middleName : parsedData.middleName;
        parsedData.nickname = parsedData.nickname ? sanitizeName(parsedData.nickname) ?? parsedData.nickname : parsedData.nickname;
        parsedData.notes = parsedData.notes ? sanitizeNotes(parsedData.notes) ?? parsedData.notes : parsedData.notes;
        parsedData.organization = parsedData.organization ? sanitizeName(parsedData.organization) ?? parsedData.organization : parsedData.organization;
        parsedData.jobTitle = parsedData.jobTitle ? sanitizeName(parsedData.jobTitle) ?? parsedData.jobTitle : parsedData.jobTitle;

        // Check for duplicates by UID
        if (parsedData.uid) {
          const existingMapping = await prisma.cardDavMapping.findFirst({
            where: {
              connectionId: connection.id,
              uid: parsedData.uid,
            },
          });

          if (existingMapping) {
            results.skipped++;
            continue; // Skip duplicate
          }
        }

        // Check if an active (non-deleted) person with this UID already exists
        // This handles reconnection: same server contacts, new connection ID
        if (parsedData.uid) {
          const existingPerson = await prisma.person.findFirst({
            where: {
              uid: parsedData.uid,
              userId: session.user.id,
            },
          });

          if (existingPerson) {
            // Person already exists — just create a new mapping and clean up
            await prisma.cardDavMapping.create({
              data: {
                connectionId: connection.id,
                personId: existingPerson.id,
                uid: parsedData.uid,
                href: pendingImport.href,
                etag: pendingImport.etag,
                syncStatus: 'synced',
                lastSyncedAt: new Date(),
              },
            });

            await prisma.cardDavPendingImport.delete({
              where: { id: pendingImport.id },
            });

            results.skipped++;
            continue;
          }
        }

        // Check if a soft-deleted person with this UID exists (O(1) lookup)
        const softDeletedPerson = parsedData.uid
          ? softDeletedMap.get(parsedData.uid) ?? null
          : null;

        let person;

        if (softDeletedPerson) {
          // Restore and update the soft-deleted person
          person = await prisma.person.update({
            where: { id: softDeletedPerson.id },
            data: {
              // Restore the person
              deletedAt: null,

              // Update with latest data from CardDAV
              name: parsedData.name || '',
              surname: parsedData.surname,
              middleName: parsedData.middleName,
              prefix: parsedData.prefix,
              suffix: parsedData.suffix,
              nickname: parsedData.nickname,
              organization: parsedData.organization,
              jobTitle: parsedData.jobTitle,
              photo: parsedData.photo,
              gender: parsedData.gender,
              anniversary: parsedData.anniversary,
              notes: parsedData.notes,

              // Update multi-value fields (deleteMany + create pattern)
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
                ? { deleteMany: {}, create: parsedData.importantDates.map((date) => ({
                    title: date.title,
                    date: date.date,
                    reminderEnabled: false,
                  }))}
                : undefined,
            },
          });
        } else {
          // Create a new person
          person = await prisma.person.create({
            data: {
              userId: session.user.id,
              name: parsedData.name || '',
              surname: parsedData.surname,
              middleName: parsedData.middleName,
              prefix: parsedData.prefix,
              suffix: parsedData.suffix,
              nickname: parsedData.nickname,
              organization: parsedData.organization,
              jobTitle: parsedData.jobTitle,
              photo: parsedData.photo,
              gender: parsedData.gender,
              anniversary: parsedData.anniversary,
              notes: parsedData.notes,
              uid: parsedData.uid || uuidv4(),

              // Create multi-value fields
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
              importantDates: parsedData.importantDates
                ? { create: parsedData.importantDates.map((date) => ({
                    title: date.title,
                    date: date.date,
                    reminderEnabled: false,
                  }))}
                : undefined,
            },
          });
        }

        // Save photo as file if present
        if (parsedData.photo && person.id) {
          const photoFilename = await savePhoto(session.user.id, person.id, parsedData.photo);
          if (photoFilename) {
            await prisma.person.update({
              where: { id: person.id },
              data: { photo: photoFilename },
            });
          }
        }

        // Create mapping
        await prisma.cardDavMapping.create({
          data: {
            connectionId: connection.id,
            personId: person.id,
            uid: parsedData.uid || person.uid!,
            href: pendingImport.href,
            etag: pendingImport.etag,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          },
        });

        // Assign to groups - merge global groups + per-contact groups
        const contactSpecificGroups = contactGroups[pendingImport.id] || [];
        const mergedGroupIds = [...new Set([...globalGroups, ...contactSpecificGroups])];

        if (mergedGroupIds.length > 0) {
          const groups = await prisma.group.findMany({
            where: {
              id: { in: mergedGroupIds },
              userId: session.user.id,
            },
          });

          if (groups.length > 0) {
            // Get existing group associations
            const existingGroupAssociations = await prisma.personGroup.findMany({
              where: { personId: person.id },
              select: { groupId: true },
            });
            const existingGroupIds = new Set(existingGroupAssociations.map((pg) => pg.groupId));

            // Only create new associations for groups that don't exist
            const newGroupAssociations = groups
              .filter((group) => !existingGroupIds.has(group.id))
              .map((group) => ({
                personId: person.id,
                groupId: group.id,
              }));

            if (newGroupAssociations.length > 0) {
              await prisma.personGroup.createMany({
                data: newGroupAssociations,
              });
            }
          }
        }

        // Delete pending import
        await prisma.cardDavPendingImport.delete({
          where: { id: pendingImport.id },
        });

        results.imported++;
      } catch (error) {
        console.error('Error importing contact:', error);
        results.errors++;
        results.errorMessages.push(
          `Failed to import ${pendingImport.displayName}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return NextResponse.json({
      success: true,
      imported: results.imported,
      skipped: results.skipped,
      errors: results.errors,
      errorMessages: results.errorMessages,
    });
  } catch (error) {
    console.error('Import failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
