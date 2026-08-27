import { env } from '@/lib/env';

export interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

/**
 * Read the VAPID keypair, or null when push is not configured.
 *
 * All three variables are required together. env validation already rejects a
 * partial set at startup, so a null here means the operator deliberately left
 * push off rather than misconfigured it.
 */
export function getVapidDetails(): VapidDetails | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return null;
  }

  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
}

export function isPushConfigured(): boolean {
  return getVapidDetails() !== null;
}
