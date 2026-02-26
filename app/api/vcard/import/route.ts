import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/vcard';
import { sanitizeName, sanitizeNotes } from '@/lib/sanitize';
import { createPersonFromVCardData } from '@/lib/carddav/person-from-vcard';
import { createModuleLogger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';
import { isSaasMode } from '@/lib/features';
import { canCreateResource, getUserUsage } from '@/lib/billing';

const log = createModuleLogger('vcard');

/**
 * POST /api/vcard/import
 * Import contacts from raw vCard file content
 */
export const POST = withLogging(async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read raw vCard text
    const vcardText = await request.text();

    if (vcardText.length > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 2MB.' }, { status: 413 });
    }

    if (!vcardText || !vcardText.trim().startsWith('BEGIN:VCARD')) {
      return NextResponse.json(
        { error: 'Invalid vCard file' },
        { status: 400 }
      );
    }

    // Split into individual vCards (handle multiple contacts in one file)
    const vcards = vcardText.split(/(?=BEGIN:VCARD)/g).filter(v => v.trim());

    // Check tier limits before importing (only in SaaS mode)
    if (isSaasMode()) {
      // Extract UIDs from all vCards to determine how many are truly new
      const vcardUIDs: string[] = [];
      for (const vcard of vcards) {
        try {
          const parsed = vCardToPerson(vcard);
          if (parsed.uid) {
            vcardUIDs.push(parsed.uid);
          } else {
            // vCards without UIDs are always new
            vcardUIDs.push('');
          }
        } catch {
          // Unparseable vCards will fail during the import loop
        }
      }

      // Batch-fetch existing people by UID to find duplicates
      const validUIDs = vcardUIDs.filter(Boolean);
      const existingByUID = validUIDs.length > 0
        ? await prisma.person.findMany({
            where: {
              uid: { in: validUIDs },
              userId: session.user.id,
            },
            select: { uid: true },
          })
        : [];
      const existingUIDSet = new Set(existingByUID.map((p) => p.uid));

      // Count how many vCards are truly new (not duplicates)
      const newCount = vcardUIDs.filter((uid) => !uid || !existingUIDSet.has(uid)).length;

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
        log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error importing vCard');
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
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'vCard import failed');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
