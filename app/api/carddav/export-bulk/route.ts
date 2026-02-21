import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createCardDavClient } from '@/lib/carddav/client';
import { personToVCard } from '@/lib/vcard';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { z } from 'zod';

const exportBulkSchema = z.object({
  personIds: z.array(z.string()).min(1, 'No contacts selected for export'),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = exportBulkSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { personIds } = validationResult.data;

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

    if (!connection.syncEnabled) {
      return NextResponse.json(
        { error: 'Sync is disabled for this connection' },
        { status: 400 }
      );
    }

    // Create CardDAV client
    const client = await createCardDavClient(connection);

    // Get address books
    const addressBooks = await client.fetchAddressBooks();
    if (addressBooks.length === 0) {
      return NextResponse.json(
        { error: 'No address books found' },
        { status: 404 }
      );
    }

    const addressBook = addressBooks[0];

    // Get people to export
    const people = await prisma.person.findMany({
      where: {
        id: { in: personIds },
        userId: session.user.id,
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

    if (people.length === 0) {
      return NextResponse.json(
        { error: 'No contacts found to export' },
        { status: 404 }
      );
    }

    // Pre-fetch all existing mappings for the requested person IDs in one query
    // to avoid N+1 per-person queries in the export loop.
    const existingMappings = await prisma.cardDavMapping.findMany({
      where: { personId: { in: personIds } },
      select: { personId: true },
    });
    const alreadyMappedPersonIds = new Set(existingMappings.map((m) => m.personId));

    const results = {
      exported: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    };

    // Process each person with rate limiting (50 per batch)
    const batchSize = 50;
    for (let i = 0; i < people.length; i += batchSize) {
      const batch = people.slice(i, i + batchSize);

      for (const person of batch) {
        try {
          // Check if already exported (O(1) set lookup instead of per-person query)
          if (alreadyMappedPersonIds.has(person.id)) {
            results.skipped++;
            continue; // Already exported
          }

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

          // Ensure ongoing sync is enabled for explicitly exported persons
          await prisma.person.update({
            where: { id: person.id },
            data: { cardDavSyncEnabled: true },
          });

          results.exported++;
        } catch (error) {
          console.error('Error exporting contact:', error);
          results.errors++;
          results.errorMessages.push(
            `Failed to export ${person.name} ${person.surname || ''}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      // Small delay between batches to avoid overwhelming the server
      if (i + batchSize < people.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Update connection last sync time
    await prisma.cardDavConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      exported: results.exported,
      skipped: results.skipped,
      errors: results.errors,
      errorMessages: results.errorMessages,
    });
  } catch (error) {
    console.error('Bulk export failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
