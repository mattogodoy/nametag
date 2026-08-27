/*
 * Nametag service worker.
 *
 * Deliberately caches almost nothing. Cache API entries are stored on disk
 * unencrypted and survive logout, so for an app holding contact details the
 * only safe things to cache are content-hashed build output, our own icons,
 * and a static offline page.
 *
 * Authenticated HTML is never cached. API responses are never cached.
 */

const VERSION = 'nametag-static-v1';
const OFFLINE_URL = '/offline';

const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png', '/logo.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // Added one at a time and tolerant of failure. addAll is atomic, so a
      // single bad URL would reject the install, skip skipWaiting(), and discard
      // the worker with no log and no offline support at all. A partial cache
      // beats none: OFFLINE_URL is the only entry that really matters.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)))
      )
      /*
       * This precache only ever runs once per browser: sw.js is a static file
       * whose bytes do not change between deploys, so the worker never sees a
       * byte-diff and this activate handler never fires again after first
       * install. It does NOT keep the offline snapshot current on every deploy.
       * ServiceWorkerRegistration (postMessage on every registration) and the
       * language-change handler in LanguageSelector are what actually keep it
       * current, by asking the already-active worker to re-fetch it.
       */
      .then(() => caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL).catch(() => {})))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RECACHE_OFFLINE') {
    event.waitUntil(
      caches.open(VERSION).then((cache) => cache.add(OFFLINE_URL).catch(() => {}))
    );
  }
});

/*
 * Content-hashed by the build, so a given URL's bytes never change. This is the
 * only surface served cache-first, and it is what makes skipWaiting() plus
 * clients.claim() safe: a page loaded before a deploy, then adopted by the new
 * worker, still finds the exact chunks it asked for.
 */
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

/*
 * Ours, small, and needed for the offline page to render with no network, but
 * NOT content-hashed: /logo.svg keeps its name when its contents change. Served
 * stale-while-revalidate rather than cache-first, because VERSION is a constant
 * so the activate purge never evicts anything. Without the revalidation a
 * redesigned logo would be served from disk forever on existing installs.
 */
function isRevalidatingAsset(url) {
  return url.pathname.startsWith('/icons/') || url.pathname === '/logo.svg';
}

/*
 * Safari does not always report mode 'navigate' the way Chromium does,
 * particularly for a standalone launch, so `destination` is checked as well.
 * A document request is a navigation whichever way it is labelled.
 */
function isNavigation(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  // Never touch these. Contact data lives behind /api, including photos.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/image')) {
    return;
  }

  if (isNavigation(request)) {
    // Network first, and the response is never written to the cache.
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(VERSION)
          .then((cache) => cache.match(OFFLINE_URL))
          .then(
            (cached) =>
              cached ||
              new Response('Offline', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
              })
          )
      )
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        })
      )
    );
    return;
  }

  if (isRevalidatingAsset(url)) {
    const opened = caches.open(VERSION);
    const refresh = opened.then((cache) =>
      fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    // waitUntil must be called synchronously during dispatch, which is why the
    // refresh promise is built before respondWith rather than inside it. It
    // keeps the worker alive until the background refresh settles.
    event.waitUntil(refresh.catch(() => {}));
    event.respondWith(
      opened.then((cache) => cache.match(request)).then((cached) => cached || refresh)
    );
  }
});

/*
 * Push notifications.
 *
 * The payload is encrypted in transit by the Web Push protocol, so the push
 * service operator cannot read the person's name. Nothing here is written to
 * the Cache API: this file deliberately caches almost nothing, and a
 * notification body holding contact details is exactly what must not land on
 * disk unencrypted.
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // A payload we cannot parse is not worth a blank notification.
    return;
  }

  if (!payload || !payload.title) {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      /*
       * Replaces rather than stacks. A reminder re-sent for the same entity
       * should update the existing notification, not pile a second one on top.
       */
      tag: payload.tag || 'nametag',
      data: { url: payload.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      /*
       * Prefer an open tab on this origin over a new window. Opening a second
       * copy of the app is disorienting, and on a standalone PWA launch it can
       * fail outright.
       */
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // The result is intentionally discarded (not awaited before
          // focus()), so a rejection here must be caught or it surfaces as an
          // unhandled rejection in the worker instead of just a missed navigation.
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }

      // `client.navigate()` above is blocked cross-origin by the platform, but
      // `openWindow()` has no such check, so the target is validated here
      // instead. `target` comes from the push payload; falling back to
      // /dashboard keeps a malformed or hostile value from opening a window
      // to an arbitrary origin.
      const safeTarget =
        target.startsWith('/') || target.startsWith(self.location.origin) ? target : '/dashboard';

      return self.clients.openWindow(safeTarget);
    })
  );
});
