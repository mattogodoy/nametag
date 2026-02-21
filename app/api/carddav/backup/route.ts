import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDAVClient } from 'tsdav';
import { validateServerUrl } from '@/lib/carddav/url-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptPassword } from '@/lib/carddav/encryption';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimitResponse = checkRateLimit(request, 'carddavBackup', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    // Look up the user's stored CardDAV connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No CardDAV connection found. Please set up a connection first.' },
        { status: 404 }
      );
    }

    const serverUrl = connection.serverUrl;
    const username = connection.username;
    const password = decryptPassword(connection.password);

    // Validate URL to prevent SSRF attacks
    try {
      await validateServerUrl(serverUrl);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid server URL' },
        { status: 400 }
      );
    }

    try {
      const client = await createDAVClient({
        serverUrl,
        credentials: {
          username,
          password,
        },
        authMethod: 'Basic',
        defaultAccountType: 'carddav',
      });

      const addressBooks = await client.fetchAddressBooks();

      const allVCards: string[] = [];

      for (const addressBook of addressBooks) {
        const vcards = await client.fetchVCards({
          addressBook,
        });

        for (const vcard of vcards) {
          if (vcard.data) {
            allVCards.push(vcard.data);
          }
        }
      }

      const vcfContent = allVCards.join('\r\n');

      return new Response(vcfContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/vcard; charset=utf-8',
          'Content-Disposition': 'attachment; filename="nametag-backup.vcf"',
          'X-Contact-Count': String(allVCards.length),
        },
      });
    } catch (error) {
      console.error('CardDAV backup failed:', error instanceof Error ? error.message : 'Unknown error');

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          return NextResponse.json(
            { error: 'Authentication failed. Please check your credentials.' },
            { status: 401 }
          );
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return NextResponse.json(
            { error: 'Server not found. Please check the server URL.' },
            { status: 404 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to fetch contacts from server.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in CardDAV backup:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
