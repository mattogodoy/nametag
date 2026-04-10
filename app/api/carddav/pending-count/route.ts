import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAlreadyMappedPersonUids } from '@/lib/carddav/mapped-uids';
import { createModuleLogger } from '@/lib/logger';
import { withLogging } from '@/lib/api-utils';

const log = createModuleLogger('carddav');

export const GET = withLogging(async function GET(_request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connection
    const connection = await prisma.cardDavConnection.findUnique({
      where: { userId: session.user.id },
    });

    if (!connection) {
      return NextResponse.json({ count: 0 });
    }

    // Exclude pending imports whose person is already mapped (under any UID)
    const alreadyMappedPersonUids = await getAlreadyMappedPersonUids(session.user.id);

    const count = await prisma.cardDavPendingImport.count({
      where: {
        connectionId: connection.id,
        ...(alreadyMappedPersonUids.size > 0
          ? { uid: { notIn: [...alreadyMappedPersonUids] } }
          : {}),
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error getting pending count');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
