import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-errors';
import { getVapidDetails } from '@/lib/notifications/vapid';

/**
 * Serve the VAPID public key.
 *
 * This has to be a runtime endpoint rather than a NEXT_PUBLIC_ variable.
 * NEXT_PUBLIC_ values are inlined at build time, and Nametag ships a prebuilt
 * Docker image, so a self-hoster setting one in .env would have no effect at
 * all.
 *
 * The key is public by definition: it is handed to every browser that
 * subscribes. It is not session-gated so that the subscribe flow works before
 * any client-side session hydration completes.
 */
export async function GET(): Promise<NextResponse> {
  const vapid = getVapidDetails();

  if (!vapid) {
    return apiError('feature_disabled', 'Push notifications are not configured', {
      feature: 'push',
      scope: 'instance',
    });
  }

  return NextResponse.json({ publicKey: vapid.publicKey });
}
