import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma, withDeleted } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/vcard';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { createPersonFromVCardData, restorePersonFromVCardData } from '@/lib/carddav/person-from-vcard';
import { createModuleLogger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';
import { isSaasMode } from '@/lib/features';
import { canCreateResource, getUserUsage } from '@/lib/billing';
import { z } from 'zod';

const log = createModuleLogger('carddav');

const importSchema = z.object({
  importIds: z.array(z.string()).min(1, 'No contacts selected for import'),
  groupIds: z.array(z.string()).optional(),
  globalGroupIds: z.array(z.string()).optional(),
  perContactGroups: z.record(z.string(), z.array(z.string())).optional(),
  globalRelationshipTypeId: z.string().nullable().optional(),
  perContactRelationshipTypeId: z.record(z.string(), z.string()).optional(),
});

export const POST = withLogging(async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = importSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { importIds, groupIds, globalGroupIds, perContactGroups, globalRelationshipTypeId, perContactRelationshipTypeId } = validationResult.data;

    // Support both old and new API formats
    const globalGroups = globalGroupIds || groupIds || [];
    const contactGroups = perContactGroups || {};
    const contactRelationships = perContactRelationshipTypeId || {};

    // Get the user's CardDAV connection (may not exist for file-only imports)
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    // Get pending imports that belong to this user — either via their
    // CardDAV connection OR via direct ownership (file imports)
    const pendingImports = await prisma.cardDavPendingImport.findMany({
      where: {
        id: { in: importIds },
        OR: [
          // CardDAV imports: pending imports under the user's connection
          ...(connection ? [{ connectionId: connection.id }] : []),
          // File imports: pending imports uploaded by this user
          { uploadedByUserId: session.user.id },
        ],
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

    // Performance optimization: Pre-fetch all data needed in the loop upfront
    // to eliminate N+1 query patterns when importing many contacts.
    const allUIDs = pendingImports
      .map((p) => {
        try {
          return vCardToPerson(p.vCardData).uid;
        } catch {
          return null;
        }
      })
      .filter((uid): uid is string => Boolean(uid));

    // Pre-fetch existing mappings for this connection to avoid per-contact queries
    // Only relevant when user has a CardDAV connection (not for file-only imports)
    const existingMappingsForConnection = allUIDs.length > 0 && connection
      ? await prisma.cardDavMapping.findMany({
          where: {
            connectionId: connection.id,
            uid: { in: allUIDs },
          },
          select: { uid: true, personId: true },
        })
      : [];
    const existingMappingsByUid = new Map(
      existingMappingsForConnection.map((m) => [m.uid, m])
    );

    // Pre-fetch existing active persons with matching UIDs to avoid per-contact queries
    const existingActivePersons = allUIDs.length > 0
      ? await prisma.person.findMany({
          where: {
            uid: { in: allUIDs },
            userId: session.user.id,
          },
          select: { id: true, uid: true },
        })
      : [];
    const existingPersonsByUid = new Map(
      existingActivePersons.map((p) => [p.uid, p])
    );

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

    // Check tier limits before importing (only in SaaS mode)
    if (isSaasMode()) {
      // Count how many pending imports are truly new using the pre-fetched maps.
      // A pending import is "new" if its UID doesn't match an existing mapping
      // or an existing active person. Soft-deleted restorations DO count as new
      // since soft-deleted records are excluded from getUserUsage counts.
      let newCount = 0;
      for (const pendingImport of pendingImports) {
        try {
          const parsed = vCardToPerson(pendingImport.vCardData);
          if (parsed.uid) {
            const hasMapping = existingMappingsByUid.has(parsed.uid);
            const hasActivePerson = existingPersonsByUid.has(parsed.uid);
            if (!hasMapping && !hasActivePerson) {
              newCount++;
            }
          } else {
            // No UID means it will always be created as new
            newCount++;
          }
        } catch {
          // Unparseable vCards will fail during the import loop
        }
      }

      if (newCount > 0) {
        const [currentUsage, usageCheck] = await Promise.all([
          getUserUsage(session.user.id),
          canCreateResource(session.user.id, 'people'),
        ]);

        const totalAfterImport = currentUsage.people + newCount;
        const available = usageCheck.limit - currentUsage.people;

        if (!usageCheck.isUnlimited && totalAfterImport > usageCheck.limit) {
          return NextResponse.json(
            {
              error: `This import would exceed your plan's contact limit. ` +
                `You have ${currentUsage.people} contacts and are trying to add ${newCount}, ` +
                `but your plan allows ${usageCheck.limit}.`,
              code: 'LIMIT_EXCEEDED',
              available: Math.max(0, available),
              requested: newCount,
            },
            { status: 403 }
          );
        }
      }
    }

    // Pre-fetch valid relationship types for assignment
    const allRelTypeIds = new Set<string>();
    if (globalRelationshipTypeId) allRelTypeIds.add(globalRelationshipTypeId);
    for (const relId of Object.values(contactRelationships)) {
      if (relId && relId !== '__none__') allRelTypeIds.add(relId);
    }
    const validRelTypeIds = new Set<string>();
    if (allRelTypeIds.size > 0) {
      const validRelTypes = await prisma.relationshipType.findMany({
        where: { id: { in: [...allRelTypeIds] }, userId: session.user.id },
        select: { id: true },
      });
      for (const rt of validRelTypes) validRelTypeIds.add(rt.id);
    }

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

        // Check for duplicates by UID (O(1) map lookup instead of per-contact query)
        if (parsedData.uid) {
          const existingMapping = existingMappingsByUid.get(parsedData.uid);

          if (existingMapping) {
            results.skipped++;
            continue; // Skip duplicate
          }
        }

        // Check if an active (non-deleted) person with this UID already exists
        // This handles reconnection: same server contacts, new connection ID
        // (O(1) map lookup instead of per-contact query)
        if (parsedData.uid) {
          const existingPerson = existingPersonsByUid.get(parsedData.uid);

          if (existingPerson) {
            // Person already exists — create a CardDAV mapping (if applicable) and clean up
            const isFileImport = pendingImport.uploadedByUserId !== null;
            if (!isFileImport && connection) {
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
            }

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
          person = await restorePersonFromVCardData(
            session.user.id,
            softDeletedPerson.id,
            parsedData,
          );
        } else {
          // Create a new person
          person = await createPersonFromVCardData(session.user.id, parsedData);
        }

        // Update the lookup map so subsequent pending imports with the same UID
        // are treated as duplicates rather than triggering another create.
        if (parsedData.uid) {
          existingPersonsByUid.set(parsedData.uid, { id: person.id, uid: parsedData.uid });
        }

        // Create CardDAV mapping only for CardDAV imports (not file imports)
        const isFileImport = pendingImport.uploadedByUserId !== null;
        if (!isFileImport && connection) {
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
        }

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

        // Assign relationship to user — per-contact overrides global
        const perContactRelValue = contactRelationships[pendingImport.id];
        const effectiveRelId = perContactRelValue === '__none__'
          ? null
          : perContactRelValue || globalRelationshipTypeId || null;
        if (effectiveRelId && validRelTypeIds.has(effectiveRelId)) {
          await prisma.person.update({
            where: { id: person.id },
            data: { relationshipToUserId: effectiveRelId },
          });
        }

        // Delete pending import
        await prisma.cardDavPendingImport.delete({
          where: { id: pendingImport.id },
        });

        results.imported++;
      } catch (error) {
        log.error({ err: error instanceof Error ? error : new Error(String(error)), displayName: pendingImport.displayName }, 'Error importing contact');
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
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Import failed');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
