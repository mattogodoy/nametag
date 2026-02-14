import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { bidirectionalSync } from '@/lib/carddav/sync';

export async function POST(_request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Perform bidirectional sync
    const result = await bidirectionalSync(session.user.id);

    return NextResponse.json({
      success: true,
      imported: result.imported,
      exported: result.exported,
      updatedLocally: result.updatedLocally,
      updatedRemotely: result.updatedRemotely,
      conflicts: result.conflicts,
      errors: result.errors,
      errorMessages: result.errorMessages,
      pendingImports: result.pendingImports || 0,
    });
  } catch (error) {
    console.error('Manual sync failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
