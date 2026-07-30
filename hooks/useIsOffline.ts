'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the browser currently reports being offline.
 *
 * `navigator.onLine` is a weak signal on its own (it can be true behind a
 * captive portal), but the callers here only consult it once something has
 * already failed, and "we errored AND the browser says offline" is a strong
 * enough combination. A false negative simply falls back to the generic error,
 * which is the previous behaviour.
 *
 * Starts as false so server and client markup agree on the first pass.
 */
export function useIsOffline(): boolean {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const sync = () => setIsOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return isOffline;
}
