import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createDAVClient } from 'tsdav';

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { serverUrl, username, password } = body;

    if (!serverUrl || !username || !password) {
      return NextResponse.json(
        { error: 'Server URL, username, and password are required' },
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
      console.error('CardDAV connection test failed:', error);

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
    console.error('Error testing CardDAV connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
