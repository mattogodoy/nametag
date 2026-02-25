import { auth } from '@/lib/auth';
import { bidirectionalSync } from '@/lib/carddav/sync';
import type { SyncProgressEvent } from '@/lib/carddav/sync';
import { checkRateLimit } from '@/lib/rate-limit';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('carddav');

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rateLimitResponse = checkRateLimit(request, 'carddavSync', session.user.id);
  if (rateLimitResponse) return rateLimitResponse;

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
        sendEvent('progress', { ...event });
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
        log.error({ err: error instanceof Error ? error : new Error(String(error)) }, 'Manual sync failed');
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
