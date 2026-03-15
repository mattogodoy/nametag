import { getAppUrl } from '@/lib/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Validates that the request originates from the same origin as the application.
 * Checks the Origin and Referer headers against the configured app URL to prevent
 * cross-site request forgery on state-changing (non-GET/HEAD/OPTIONS) requests.
 */
export function validateOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) {
    return true;
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // If neither header is present, allow the request.
  // Trade-off: some browsers omit Origin on same-origin POST, and non-browser
  // clients (cURL, server-to-server) never send it. Blocking these would break
  // legitimate use. The risk is low because an attacker would need to craft a
  // request that strips both Origin and Referer, which modern browsers prevent
  // for cross-origin form submissions.
  if (!origin && !referer) {
    return true;
  }

  const appUrl = getAppUrl();
  const expectedOrigin = new URL(appUrl).origin;

  if (origin) {
    return origin === expectedOrigin;
  }

  try {
    return new URL(referer!).origin === expectedOrigin;
  } catch {
    return false;
  }
}
