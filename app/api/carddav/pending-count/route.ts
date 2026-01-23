import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
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

    // Count pending imports
    const count = await prisma.cardDavPendingImport.count({
      where: {
        connectionId: connection.id,
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error getting pending count:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
