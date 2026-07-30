import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/carddav/vcard-import';
import { createModuleLogger } from '@/lib/logger';
import { apiResponse, handleApiError, withAuth } from '@/lib/api-utils';

const log = createModuleLogger('vcard');

/**
 * POST /api/vcard/upload
 * Upload vCard file and prepare for import (creates temporary pending imports)
 */
export const POST = withAuth(async (request, session) => {
  try {

    // Read raw vCard text
    const vcardText = await request.text();

    if (vcardText.length > 2 * 1024 * 1024) {
      return apiResponse.payloadTooLarge('File too large. Maximum size is 2MB.');
    }

    if (!vcardText || !vcardText.trim().startsWith('BEGIN:VCARD')) {
      return apiResponse.error('Invalid vCard file');
    }

    // Delete any existing pending file imports for this user
    await prisma.cardDavPendingImport.deleteMany({
      where: {
        uploadedByUserId: session.user.id,
        connectionId: null, // File imports have no connection
      },
    });

    // Split into individual vCards and deduplicate by UID (last occurrence wins).
    // Without dedup, NULL connectionId means @@unique([connectionId, uid]) won't
    // prevent duplicate rows, which then fail during import.
    const rawVcards = vcardText.split(/(?=BEGIN:VCARD)/g).filter(v => v.trim());
    const deduped = new Map<string, { vcard: string; index: number }>();

    for (let i = 0; i < rawVcards.length; i++) {
      const vcard = rawVcards[i];
      try {
        const parsedData = vCardToPerson(vcard);
        const uid = parsedData.uid || `file-import-${Date.now()}-${i}`;
        deduped.set(uid, { vcard, index: i });
      } catch (error) {
        log.error({ err: error instanceof Error ? error : new Error(String(error)), index: i }, 'Error parsing vCard');
      }
    }

    const createdImports = [];

    for (const [uid, { vcard, index }] of deduped) {
      try {
        const parsedData = vCardToPerson(vcard);
        const displayName = [parsedData.prefix, parsedData.name, parsedData.middleName, parsedData.surname, parsedData.secondLastName, parsedData.suffix]
          .filter(Boolean)
          .join(' ') || parsedData.nickname || 'Unknown Contact';

        // Create pending import — no connectionId needed for file imports
        const pendingImport = await prisma.cardDavPendingImport.create({
          data: {
            uploadedByUserId: session.user.id,
            uid,
            href: `file-import-${Date.now()}-${index}`,
            etag: `file-${Date.now()}`,
            displayName,
            vCardData: vcard,
          },
        });

        createdImports.push(pendingImport);
      } catch (error) {
        log.error({ err: error instanceof Error ? error : new Error(String(error)), uid }, 'Error creating pending import');
      }
    }

    return apiResponse.ok({
      success: true,
      count: createdImports.length,
    });
  } catch (error) {
    return handleApiError(error, 'vcard-upload');
  }
});
