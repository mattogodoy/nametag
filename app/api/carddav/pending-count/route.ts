import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

    // Get UIDs of persons already mapped (under any UID) to exclude stale
    // pending imports that would just be skipped during import.
    const alreadyMappedPersonUids = new Set(
      (await prisma.person.findMany({
        where: {
          userId: session.user.id,
          deletedAt: null,
          uid: { not: null },
          cardDavMapping: { isNot: null },
        },
        select: { uid: true },
      })).map((p) => p.uid!)
    );

    // Count pending imports, excluding already-mapped contacts
    if (alreadyMappedPersonUids.size === 0) {
      const count = await prisma.cardDavPendingImport.count({
        where: { connectionId: connection.id },
      });
      return NextResponse.json({ count });
    }

    // When there are mapped UIDs to exclude, fetch and filter
    const allPending = await prisma.cardDavPendingImport.findMany({
      where: { connectionId: connection.id },
      select: { uid: true },
    });
    const count = allPending.filter((p) => !alreadyMappedPersonUids.has(p.uid)).length;

    return NextResponse.json({ count });
  } catch (error) {
    log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Error getting pending count');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
