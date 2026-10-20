import { apiError } from '@/lib/api-errors';
import { prisma } from '@/lib/prisma';
import { createDAVClient } from 'tsdav';
import { validateServerUrl } from '@/lib/carddav/url-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { decryptPassword } from '@/lib/carddav/encryption';
import { createModuleLogger } from '@/lib/logger';
import { withAuth } from '@/lib/api-utils';

const log = createModuleLogger('carddav');

// Accepts arbitrary server credentials in the body and dials the given host, so
// it stays session-only: an API token must not be able to drive outbound
// requests to a server of the caller's choosing.
export const POST = withAuth(async (request, session) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'carddavBackup', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    // Support both: credentials from request body (wizard flow) or saved connection
    const body = await request.json().catch(() => ({}));
    const bodyCredentials = body as { serverUrl?: string; username?: string; password?: string };

    let serverUrl: string;
    let username: string;
    let password: string;

    if (bodyCredentials.serverUrl && bodyCredentials.username && bodyCredentials.password) {
      // Wizard flow: credentials provided directly in request body
      serverUrl = bodyCredentials.serverUrl;
      username = bodyCredentials.username;
      password = bodyCredentials.password;
    } else {
      // Post-setup flow: look up saved connection
      const connection = await prisma.cardDavConnection.findUnique({
        where: { userId: session.user.id },
      });

      if (!connection) {
        return apiError('not_found', 'No CardDAV connection found. Please set up a connection first.');
      }

      serverUrl = connection.serverUrl;
      username = connection.username;
      password = decryptPassword(connection.password);
    }

    // Validate URL to prevent SSRF attacks
    try {
      await validateServerUrl(serverUrl);
    } catch (error) {
      return apiError('bad_request', error instanceof Error ? error.message : 'Invalid server URL');
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
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'CardDAV backup failed');

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          return apiError('unauthorized', 'Authentication failed. Please check your credentials.');
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return apiError('not_found', 'Server not found. Please check the server URL.');
        }
      }

      return apiError('internal_error', 'Failed to fetch contacts from server.');
    }
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error in CardDAV backup');
    return apiError('internal_error', 'Internal server error');
  }
}, { allowApiTokens: false });
