import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createDAVClient } from 'tsdav';
import { validateServerUrl } from '@/lib/carddav/url-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const connectionTestSchema = z.object({
  serverUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

      // Try to fetch address books to verify connection
      await client.fetchAddressBooks();

      return NextResponse.json({
        success: true,
        message: 'Connection successful',
      });
    } catch (error) {
      console.error('CardDAV connection test failed:', error instanceof Error ? error.message : 'Unknown error');

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
    console.error('Error testing CardDAV connection:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
