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
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        /*
         * Refresh the precached offline page on every load. sw.js is a static file
         * whose bytes never change between deploys, so the worker's activate handler
         * fires only once per install and cannot keep this snapshot current with the
         * live build, theme or locale.
         *
         * `active` is null immediately after a first-ever registration, while the
         * worker is still installing. That is fine: the refresh lands on the next
         * load instead.
         */
        registration.active?.postMessage({ type: 'RECACHE_OFFLINE' });
      })
      .catch(() => {});
  }, []);

  return null;
}
