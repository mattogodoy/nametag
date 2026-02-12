import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vCardToPerson } from '@/lib/carddav/vcard';

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

    // Get or create a special "File Import" connection marker
    // We use a consistent ID so all file imports share the same connection
    const FILE_IMPORT_CONNECTION_ID = '00000000-0000-0000-0000-000000000001';

    let fileImportConnection = await prisma.cardDavConnection.findUnique({
      where: { id: FILE_IMPORT_CONNECTION_ID },
    });

    if (!fileImportConnection) {
      // Create the special file import connection
      fileImportConnection = await prisma.cardDavConnection.create({
        data: {
          id: FILE_IMPORT_CONNECTION_ID,
          userId: session.user.id,
          serverUrl: 'file-import',
          username: 'file-import',
          password: '', // Not used for file imports
          syncEnabled: false,
          autoExportNew: false,
        },
      });
    }

    // Delete any existing pending imports for this user from file imports
    await prisma.cardDavPendingImport.deleteMany({
      where: {
        connectionId: FILE_IMPORT_CONNECTION_ID,
        connection: {
          userId: session.user.id,
        },
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
        const displayName = [parsedData.prefix, parsedData.name, parsedData.middleName, parsedData.surname, parsedData.suffix]
          .filter(Boolean)
          .join(' ') || parsedData.nickname || 'Unknown Contact';

        // Create pending import
        const pendingImport = await prisma.cardDavPendingImport.create({
          data: {
            connectionId: FILE_IMPORT_CONNECTION_ID,
            uid: parsedData.uid || `file-import-${Date.now()}-${i}`,
            href: `file-import-${Date.now()}-${i}`, // Unique identifier
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
      connectionId: FILE_IMPORT_CONNECTION_ID,
    });
  } catch (error) {
    console.error('vCard upload failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
