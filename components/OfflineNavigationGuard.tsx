'use client';

import { useEffect } from 'react';

/**
 * Forces a hard navigation for in-app link clicks while offline.
 *
 * On a soft (client-side) navigation, Next's App Router fetches the RSC
 * payload for the destination. The service worker deliberately lets that
 * fetch through rather than caching it, because it can carry contact data.
 * Offline, that fetch fails, but the router appears to leave the transition
 * pending instead of throwing, so no error boundary ever fires and the UI
 * just freezes on the previous screen.
 *
 * A hard navigation bypasses the router entirely and goes through the
 * service worker's navigate branch instead, which serves the cached
 * `/offline` page. That turns a silent freeze into a page the user can
 * actually act on.
 */
export default function OfflineNavigationGuard() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (navigator.onLine) {
        return;
      }

      // Only plain, unmodified primary-button clicks should be hijacked.
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a');
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href) {
        return;
      }

      // A hash-only link (e.g. `#section`) is same-document navigation,
      // which the browser handles natively offline without touching the
      // network at all.
      if (href.startsWith('#')) {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      window.location.assign(anchor.href);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
