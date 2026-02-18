import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/vcard';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { createPersonFromVCardData } from '@/lib/carddav/person-from-vcard';

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

        // Sanitize imported data to prevent XSS attacks
        parsedData.name = sanitizeName(parsedData.name) || parsedData.name;
        parsedData.surname = parsedData.surname ? sanitizeName(parsedData.surname) ?? parsedData.surname : parsedData.surname;
        parsedData.middleName = parsedData.middleName ? sanitizeName(parsedData.middleName) ?? parsedData.middleName : parsedData.middleName;
        parsedData.nickname = parsedData.nickname ? sanitizeName(parsedData.nickname) ?? parsedData.nickname : parsedData.nickname;
        parsedData.notes = parsedData.notes ? sanitizeNotes(parsedData.notes) ?? parsedData.notes : parsedData.notes;
        parsedData.organization = parsedData.organization ? sanitizeName(parsedData.organization) ?? parsedData.organization : parsedData.organization;
        parsedData.jobTitle = parsedData.jobTitle ? sanitizeName(parsedData.jobTitle) ?? parsedData.jobTitle : parsedData.jobTitle;

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

        // Create a new person (includes photo saving)
        await createPersonFromVCardData(session.user.id, parsedData);

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
