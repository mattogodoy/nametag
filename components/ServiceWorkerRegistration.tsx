'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker in production only.
 *
 * In development a worker left over from a local production build would serve
 * stale assets for the rest of the session, which is a nasty debugging trap,
 * so development actively unregisters instead. To exercise the worker locally
 * run `npm run build && npm start`.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {});
      return;
    }

    // Offline support is a progressive enhancement, so a failure here is not
    // worth surfacing to the user.
    void navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
