import { NextResponse } from 'next/server';
import { createDAVClient } from 'tsdav';
import { validateServerUrl } from '@/lib/carddav/url-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';
import { withAuth } from '@/lib/api-utils';
import { z } from 'zod';

const log = createModuleLogger('carddav');

const connectionTestSchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

// Dials whatever host the caller supplies, so it stays session-only: an API
// token must not be able to drive outbound requests to an arbitrary server.
export const POST = withAuth(async (request, session) => {
  try {
    const rateLimitResponse = checkRateLimit(request, 'carddavTest', session.user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const validationResult = connectionTestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { serverUrl, username, password } = validationResult.data;

    // Validate URL to prevent SSRF attacks
    try {
      await validateServerUrl(serverUrl);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid server URL' },
        { status: 400 }
      );
    }

    // Test connection using tsdav
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

      // Fetch address books to verify connection
      const addressBooks = await client.fetchAddressBooks();

      // For each address book, do a lightweight PROPFIND (depth 1) requesting
      // only getetag and addressbook-description. This gives us:
      // - Contact count: number of child resources with an etag
      // - Description: from the collection resource itself (first response)
      // tsdav's fetchAddressBooks doesn't expose the description, so we read it
      // from the raw PROPFIND response.
      const addressBooksWithCounts = await Promise.all(
        addressBooks.map(async (ab) => {
          const absoluteUrl = /^https?:\/\//i.test(ab.url) ? ab.url : new URL(ab.url, serverUrl).href;
          let contactCount: number | null = null;
          let description: string | null = null;
          try {
            const resources = await client.propfind({
              url: absoluteUrl,
              props: {
                'd:getetag': {},
                'card:addressbook-description': {},
              },
              depth: '1',
            });
            // First response is the collection itself; the rest are vCard resources
            contactCount = Math.max(0, resources.length - 1);
            // Read description from the collection resource (first response)
            const collectionProps = resources[0]?.props as Record<string, unknown> | undefined;
            const rawDesc = collectionProps?.addressbookDescription;
            if (typeof rawDesc === 'string' && rawDesc.trim()) {
              description = rawDesc.trim();
            }
          } catch (err) {
            log.warn({ err: err instanceof Error ? err : new Error(String(err)), url: absoluteUrl }, 'Failed to count contacts in address book');
          }
          return {
            url: absoluteUrl,
            displayName: typeof ab.displayName === 'string' ? ab.displayName : null,
            description,
            contactCount,
          };
        })
      );

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
        addressBooks: addressBooksWithCounts,
      });
    } catch (error) {
      log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'CardDAV connection test failed');

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
          return NextResponse.json(
            { error: 'Authentication failed. Please check your username and password.' },
            { status: 401 }
          );
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return NextResponse.json(
            { error: 'Server not found. Please check the server URL.' },
            { status: 404 }
          );
        }
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
          return NextResponse.json(
            { error: 'Connection timeout. Please check the server URL and your network.' },
            { status: 408 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to connect to CardDAV server. Please check your settings.' },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error testing CardDAV connection');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}, { allowApiToken: false });
