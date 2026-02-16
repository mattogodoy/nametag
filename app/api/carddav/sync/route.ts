import { auth } from '@/lib/auth';
import { bidirectionalSync } from '@/lib/carddav/sync';
import type { SyncProgressEvent } from '@/lib/carddav/sync';

export async function POST(_request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      const onProgress = (event: SyncProgressEvent) => {
        sendEvent('progress', event as unknown as Record<string, unknown>);
      };

      try {
        const result = await bidirectionalSync(userId, onProgress);

        sendEvent('complete', {
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
        sendEvent('error', {
          error: error instanceof Error ? error.message : 'Sync failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
