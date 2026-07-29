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
      .then((cache) => cache.addAll(PRECACHE))
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
      // Refresh the offline page, whose copy is frozen in whatever language
      // the user had when it was first cached.
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
 * Content-hashed or otherwise immutable, and free of personal data.
 * skipWaiting() and clients.claim() above are only safe because this is the
 * entire cacheable surface: there is no version skew risk between a cached
 * asset and a running page.
 */
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.svg'
  );
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

  if (request.mode === 'navigate') {
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

  if (isCacheableAsset(url)) {
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
  }
});
