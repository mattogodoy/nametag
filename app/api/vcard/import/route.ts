import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/carddav/vcard';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/vcard/import
 * Import contacts from raw vCard file content
 */
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read raw vCard text
    const vcardText = await request.text();

    if (!vcardText || !vcardText.trim().startsWith('BEGIN:VCARD')) {
      return NextResponse.json(
        { error: 'Invalid vCard file' },
        { status: 400 }
      );
    }

    // Split into individual vCards (handle multiple contacts in one file)
    const vcards = vcardText.split(/(?=BEGIN:VCARD)/g).filter(v => v.trim());

    const results = {
      imported: 0,
      skipped: 0,
      errors: 0,
      errorMessages: [] as string[],
    };

    for (const vcard of vcards) {
      try {
        // Parse vCard
        const parsedData = vCardToPerson(vcard);

        // Check for duplicates by UID (skip if already exists)
        if (parsedData.uid) {
          const existingPerson = await prisma.person.findFirst({
            where: {
              uid: parsedData.uid,
              userId: session.user.id,
            },
          });

          if (existingPerson) {
            results.skipped++;
            continue; // Skip duplicate
          }
        }

        // Create a new person
        await prisma.person.create({
          data: {
            userId: session.user.id,
            name: parsedData.name || 'Unknown',
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
            phoneNumbers: parsedData.phoneNumbers && parsedData.phoneNumbers.length > 0
              ? { create: parsedData.phoneNumbers }
              : undefined,
            emails: parsedData.emails && parsedData.emails.length > 0
              ? { create: parsedData.emails }
              : undefined,
            addresses: parsedData.addresses && parsedData.addresses.length > 0
              ? { create: parsedData.addresses }
              : undefined,
            urls: parsedData.urls && parsedData.urls.length > 0
              ? { create: parsedData.urls }
              : undefined,
            imHandles: parsedData.imHandles && parsedData.imHandles.length > 0
              ? { create: parsedData.imHandles }
              : undefined,
            locations: parsedData.locations && parsedData.locations.length > 0
              ? { create: parsedData.locations }
              : undefined,
            customFields: parsedData.customFields && parsedData.customFields.length > 0
              ? { create: parsedData.customFields }
              : undefined,
            importantDates: parsedData.importantDates && parsedData.importantDates.length > 0
              ? {
                  create: parsedData.importantDates.map((date) => ({
                    title: date.title,
                    date: date.date,
                    reminderEnabled: false,
                  }))
                }
              : undefined,
          },
        });

        results.imported++;
      } catch (error) {
        console.error('Error importing vCard:', error);
        results.errors++;
        results.errorMessages.push(
          `Failed to import contact: ${
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
    console.error('vCard import failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
