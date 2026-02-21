import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/vcard';

/**
 * POST /api/vcard/upload
 * Upload vCard file and prepare for import (creates temporary pending imports)
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

    // Delete any existing pending file imports for this user
    await prisma.cardDavPendingImport.deleteMany({
      where: {
        uploadedByUserId: session.user.id,
        connectionId: null, // File imports have no connection
      },
    });

    // Split into individual vCards
    const vcards = vcardText.split(/(?=BEGIN:VCARD)/g).filter(v => v.trim());

    const createdImports = [];

    for (let i = 0; i < vcards.length; i++) {
      const vcard = vcards[i];

      try {
        // Parse vCard to get display name
        const parsedData = vCardToPerson(vcard);
        const displayName = [parsedData.prefix, parsedData.name, parsedData.middleName, parsedData.surname, parsedData.secondLastName, parsedData.suffix]
          .filter(Boolean)
          .join(' ') || parsedData.nickname || 'Unknown Contact';

        // Create pending import — no connectionId needed for file imports
        const pendingImport = await prisma.cardDavPendingImport.create({
          data: {
            uploadedByUserId: session.user.id,
            uid: parsedData.uid || `file-import-${Date.now()}-${i}`,
            href: `file-import-${Date.now()}-${i}`,
            etag: `file-${Date.now()}`,
            displayName,
            vCardData: vcard,
          },
        });

        createdImports.push(pendingImport);
      } catch (error) {
        console.error('Error parsing vCard:', error);
        // Continue with other vCards even if one fails
      }
    }

    return NextResponse.json({
      success: true,
      count: createdImports.length,
    });
  } catch (error) {
    console.error('vCard upload failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
