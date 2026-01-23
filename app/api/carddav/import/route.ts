import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/carddav/vcard';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { importIds, groupIds } = body; // Array of pending import IDs and optional group IDs per import

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

    for (const pendingImport of pendingImports) {
      try {
        // Parse vCard
        const parsedData = vCardToPerson(pendingImport.vCardData);

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

        // Create person
        const person = await prisma.person.create({
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
            role: parsedData.role,
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
          },
        });

        // Create mapping
        await prisma.cardDavMapping.create({
          data: {
            connectionId: connection.id,
            personId: person.id,
            uid: parsedData.uid || person.uid!,
            href: pendingImport.href,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          },
        });

        // Assign to groups if specified
        if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
          const groups = await prisma.group.findMany({
            where: {
              id: { in: groupIds },
              userId: session.user.id,
            },
          });

          if (groups.length > 0) {
            await prisma.personGroup.createMany({
              data: groups.map((group) => ({
                personId: person.id,
                groupId: group.id,
              })),
            });
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
