import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { discoverNewContacts } from '@/lib/carddav/discover';
import { createModuleLogger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';

const log = createModuleLogger('carddav');

export const POST = withLogging(async function POST(_request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Discover new contacts
    const result = await discoverNewContacts(session.user.id);

    return NextResponse.json({
      success: true,
      discovered: result.discovered,
      errors: result.errors,
      errorMessages: result.errorMessages,
    });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Discovery failed');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed',
      },
      { status: 500 }
    );
  }
});
