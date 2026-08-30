import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SW_SOURCE = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');

const ORIGIN = 'https://nametag.test';

type Handler = (event: FakeEvent) => void;

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  destination: string;
}

interface FakeEvent {
  request?: FakeRequest;
  data?: { type?: string; json?: () => unknown };
  notification?: { close: () => void; data: unknown };
  respondWith?: (value: unknown) => void;
  waitUntil: (value: unknown) => void;
}

/**
 * Everything the worker wrote to the cache. Asserting on routing alone is not
 * enough: adding a cache.put inside the navigate branch would leave a
 * routing-only suite entirely green while writing authenticated HTML to disk.
 */
interface Recorder {
  adds: string[];
  puts: string[];
  notifications: Array<{ title: string; options: Record<string, unknown> }>;
  openedWindows: string[];
  focusedClients: string[];
  navigatedTo: string[];
  deletes: string[];
}

interface Scope {
  handlers: Map<string, Handler>;
  recorder: Recorder;
  setClients: (clients: Array<{ url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }>) => void;
}

function keyOf(target: FakeRequest | string): string {
  const raw = typeof target === 'string' ? target : target.url;
  const parsed = new URL(raw, ORIGIN);
  return parsed.pathname + parsed.search;
}

/** Executes public/sw.js against a stub scope that records cache writes. */
function loadWorker(): Scope {
  const handlers = new Map<string, Handler>();
  const recorder: Recorder = { adds: [], puts: [], notifications: [], openedWindows: [], focusedClients: [], navigatedTo: [], deletes: [] };
  const store = new Map<string, unknown>();
  let openClients: Array<{ url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }> = [];

  const cache = {
    add: (url: string) => {
      recorder.adds.push(keyOf(url));
      return Promise.resolve();
    },
    addAll: (urls: string[]) => {
      urls.forEach((url) => recorder.adds.push(keyOf(url)));
      return Promise.resolve();
    },
    match: (target: FakeRequest | string) => Promise.resolve(store.get(keyOf(target))),
    put: (target: FakeRequest | string, response: unknown) => {
      recorder.puts.push(keyOf(target));
      store.set(keyOf(target), response);
      return Promise.resolve();
    },
    // The real Cache API returns entries in insertion order, which is what
    // the oldest-first trim relies on. A Map preserves that.
    //
    // Absolute URLs, because that is what a real Request carries. Returning
    // the bare pathname this store is keyed by made `new URL(request.url)`
    // throw inside the trim, which swallowed it and left this suite passing
    // against a trim that never ran.
    keys: () => Promise.resolve([...store.keys()].map((path) => ({ url: `${ORIGIN}${path}` }))),
    delete: (target: FakeRequest | string) => {
      const key = keyOf(target);
      recorder.deletes.push(key);
      return Promise.resolve(store.delete(key));
    },
  };

  const workerSelf = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(openClients),
      openWindow: (url: string) => {
        recorder.openedWindows.push(url);
        return Promise.resolve(null);
      },
    },
    location: { origin: ORIGIN },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        recorder.notifications.push({ title, options });
        return Promise.resolve();
      },
    },
  };

  const workerCaches = {
    open: () => Promise.resolve(cache),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
  };

  // sw.js is a plain script, not a module, so it cannot be imported. Running it
  // in a stub scope is the only way to exercise the real routing logic.
  // (No eslint-disable needed: this project enables neither no-implied-eval nor
  // no-new-func, and an unused disable directive is itself a lint warning.)
  const factory = new Function('self', 'caches', 'fetch', 'URL', 'Response', SW_SOURCE);
  factory(
    workerSelf,
    workerCaches,
    () => Promise.resolve(new Response('ok', { status: 200 })),
    URL,
    Response
  );

  const setClients = (clients: Array<{ url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }>) => {
    openClients = clients.map((client) => ({
      url: client.url,
      focus: () => {
        recorder.focusedClients.push(client.url);
        return client.focus();
      },
      navigate: (url: string) => {
        recorder.navigatedTo.push(url);
        return client.navigate(url);
      },
    }));
  };

  return { handlers, recorder, setClients };
}

/** Dispatches a lifecycle event and collects every promise the worker handed back. */
function dispatchLifecycle(scope: Scope, type: string, data?: { type?: string }): Promise<unknown> {
  const pending: Promise<unknown>[] = [];
  const event: FakeEvent = {
    data,
    respondWith: () => {},
    waitUntil: (value) => pending.push(Promise.resolve(value)),
  };
  scope.handlers.get(type)?.(event);
  return Promise.allSettled(pending);
}

function dispatchFetch(
  scope: Scope,
  url: string,
  init: { method?: string; mode?: string; destination?: string } = {}
): { responded: boolean; settled: Promise<unknown> } {
  const pending: Promise<unknown>[] = [];
  let responded = false;

  const event: FakeEvent = {
    request: {
      url,
      method: init.method ?? 'GET',
      mode: init.mode ?? 'no-cors',
      destination: init.destination ?? '',
    },
    respondWith: (value) => {
      responded = true;
      pending.push(Promise.resolve(value));
    },
    waitUntil: (value) => {
      pending.push(Promise.resolve(value));
    },
  };

  scope.handlers.get('fetch')?.(event);

  return {
    responded,
    // Cache writes happen after fetch resolves, so await this before asserting
    // on the recorder.
    settled: Promise.allSettled(pending),
  };
}

/** Dispatches a push event whose data behaves like a real PushMessageData. */
function dispatchPush(scope: Scope, json?: () => unknown): Promise<PromiseSettledResult<unknown>[]> {
  const pending: Promise<unknown>[] = [];
  scope.handlers.get('push')?.({
    data: json ? { json } : undefined,
    respondWith: () => {},
    waitUntil: (value: unknown) => pending.push(Promise.resolve(value)),
  });
  return Promise.allSettled(pending);
}

function dispatchNotificationClick(scope: Scope, data: unknown): Promise<{ settled: PromiseSettledResult<unknown>[]; closed: boolean }> {
  const pending: Promise<unknown>[] = [];
  let closed = false;
  scope.handlers.get('notificationclick')?.({
    notification: { close: () => { closed = true; }, data },
    respondWith: () => {},
    waitUntil: (value: unknown) => pending.push(Promise.resolve(value)),
  });
  return Promise.allSettled(pending).then((r: PromiseSettledResult<unknown>[]) => ({ settled: r, closed }));
}

describe('public/sw.js', () => {
  let scope: Scope;

  beforeEach(() => {
    scope = loadWorker();
  });

  it('registers the six lifecycle handlers', () => {
    expect([...scope.handlers.keys()].sort()).toEqual([
      'activate',
      'fetch',
      'install',
      'message',
      'notificationclick',
      'push',
    ]);
  });

  it('precaches the offline page and the assets it needs', async () => {
    await dispatchLifecycle(scope, 'install');

    expect(scope.recorder.adds).toContain('/offline');
    // The offline page renders the logo, so it has to be cached too or the
    // fallback shows a broken image exactly when it matters.
    expect(scope.recorder.adds).toContain('/logo.svg');
  });

  it('re-fetches the offline page on RECACHE_OFFLINE and ignores other messages', async () => {
    await dispatchLifecycle(scope, 'message', { type: 'SOMETHING_ELSE' });
    expect(scope.recorder.adds).toEqual([]);

    // This exact string is the contract LanguageSelector relies on.
    await dispatchLifecycle(scope, 'message', { type: 'RECACHE_OFFLINE' });
    expect(scope.recorder.adds).toEqual(['/offline']);
  });

  describe('fetch routing', () => {
    it('intercepts navigations so it can serve the offline page', () => {
      expect(dispatchFetch(scope, `${ORIGIN}/people`, { mode: 'navigate' }).responded).toBe(true);
    });

    /*
     * Safari does not always set mode: 'navigate', particularly for a
     * standalone (installed) launch. A document request has to be treated as
     * a navigation regardless of how its mode is labelled, or the offline
     * page never gets a chance to render on iOS.
     */
    it('intercepts a document request even when mode is not navigate', () => {
      expect(
        dispatchFetch(scope, `${ORIGIN}/people`, { mode: 'cors', destination: 'document' })
          .responded
      ).toBe(true);
    });

    it('intercepts immutable build output', () => {
      expect(dispatchFetch(scope, `${ORIGIN}/_next/static/chunks/main.js`).responded).toBe(true);
    });

    it('intercepts its own icons', () => {
      expect(dispatchFetch(scope, `${ORIGIN}/icons/icon-192.png`).responded).toBe(true);
    });

    it('never intercepts API requests', () => {
      expect(dispatchFetch(scope, `${ORIGIN}/api/people`).responded).toBe(false);
      expect(dispatchFetch(scope, `${ORIGIN}/api/photos/abc`).responded).toBe(false);
      // Guard ordering: the API check must come before the navigate branch.
      expect(dispatchFetch(scope, `${ORIGIN}/api/people`, { mode: 'navigate' }).responded).toBe(
        false
      );
      // Same ordering check, but via the destination-based detection added for
      // Safari: an /api/ path must never be served by the navigation branch
      // even when it looks like a document request.
      expect(
        dispatchFetch(scope, `${ORIGIN}/api/people`, { mode: 'cors', destination: 'document' })
          .responded
      ).toBe(false);
    });

    it('never intercepts optimised images', () => {
      expect(dispatchFetch(scope, `${ORIGIN}/_next/image?url=%2Ffoo.png`).responded).toBe(false);
    });

    it('never intercepts non-GET requests', () => {
      expect(
        dispatchFetch(scope, `${ORIGIN}/people`, { method: 'POST', mode: 'navigate' }).responded
      ).toBe(false);
      expect(dispatchFetch(scope, `${ORIGIN}/people`, { method: 'DELETE' }).responded).toBe(false);
    });

    it('never intercepts cross-origin requests', () => {
      expect(dispatchFetch(scope, 'https://tiles.openfreemap.org/styles/liberty').responded).toBe(
        false
      );
    });

    it('does not intercept the RSC payload fetch, which carries contact data', () => {
      // Same-origin GET, not under /api/, and mode is 'cors' rather than
      // 'navigate'. This is the real leak vector, and the reason the cacheable
      // surface is an allowlist rather than a denylist.
      expect(dispatchFetch(scope, `${ORIGIN}/people?_rsc=abc123`, { mode: 'cors' }).responded).toBe(
        false
      );
    });

    it('does not intercept ordinary same-origin paths it has no rule for', () => {
      expect(dispatchFetch(scope, `${ORIGIN}/robots.txt`).responded).toBe(false);
    });
  });

  // Routing says what the worker answers. These say what it stores, which is
  // the part with privacy consequences.
  describe('what reaches the cache', () => {
    it('stores nothing when serving a navigation', async () => {
      await dispatchFetch(scope, `${ORIGIN}/dashboard`, { mode: 'navigate' }).settled;

      // Authenticated HTML must never land on disk: cache entries are
      // unencrypted and outlive logout.
      expect(scope.recorder.puts).toEqual([]);
    });

    it('stores nothing for an API request', async () => {
      await dispatchFetch(scope, `${ORIGIN}/api/people`).settled;
      expect(scope.recorder.puts).toEqual([]);
    });

    it('stores nothing for the RSC payload fetch', async () => {
      await dispatchFetch(scope, `${ORIGIN}/people?_rsc=abc123`, { mode: 'cors' }).settled;
      expect(scope.recorder.puts).toEqual([]);
    });

    it('stores immutable build output', async () => {
      await dispatchFetch(scope, `${ORIGIN}/_next/static/chunks/main.js`).settled;
      expect(scope.recorder.puts).toEqual(['/_next/static/chunks/main.js']);
    });

    it('refreshes the non-hashed assets in the background', async () => {
      await dispatchFetch(scope, `${ORIGIN}/logo.svg`).settled;

      // Stale-while-revalidate: /logo.svg is not content-hashed, so a refresh
      // must reach the cache rather than the cached copy being served forever.
      expect(scope.recorder.puts).toEqual(['/logo.svg']);
    });
  });

  describe('push notifications', () => {
    it('shows a notification with the right title, body, tag, and url from a valid payload', async () => {
      await dispatchPush(scope, () => ({
        title: 'Birthday: Alice',
        body: 'Alice Smith turns 30 today',
        url: '/people/person-123',
        tag: 'birthday:person-123',
      }));

      expect(scope.recorder.notifications).toHaveLength(1);
      const notif = scope.recorder.notifications[0]!;
      expect(notif.title).toBe('Birthday: Alice');
      expect(notif.options.body).toBe('Alice Smith turns 30 today');
      expect(notif.options.tag).toBe('birthday:person-123');
      expect(notif.options.data).toEqual({ url: '/people/person-123' });
    });

    it('shows nothing when event.data is absent', async () => {
      await dispatchPush(scope, undefined);
      expect(scope.recorder.notifications).toEqual([]);
    });

    it('shows nothing when the payload is malformed JSON', async () => {
      await dispatchPush(scope, () => {
        throw new Error('Invalid JSON');
      });
      expect(scope.recorder.notifications).toEqual([]);
    });

    it('shows nothing when the payload has no title', async () => {
      await dispatchPush(scope, () => ({
        body: 'Some body text',
        url: '/dashboard',
        tag: 'some-tag',
      }));
      expect(scope.recorder.notifications).toEqual([]);
    });

    it('writes nothing to the cache', async () => {
      await dispatchPush(scope, () => ({
        title: 'Test Notification',
        body: 'Test body',
        url: '/people/test',
        tag: 'test:123',
      }));

      // The notification body carries a person's name, which must never land on
      // disk unencrypted. Cache API entries survive logout, so we must assert
      // that push handlers never write to caches.
      expect(scope.recorder.puts).toEqual([]);
      expect(scope.recorder.adds).toEqual([]);
    });
  });

  describe('notification clicks', () => {
    it('focuses an existing tab and navigates it to the payload url', async () => {
      scope.setClients([
        {
          url: `${ORIGIN}/people`,
          focus: async () => {},
          navigate: async () => {},
        },
      ]);

      const result = await dispatchNotificationClick(scope, { url: '/people/person-123' });

      expect(result.closed).toBe(true);
      expect(scope.recorder.navigatedTo).toEqual(['/people/person-123']);
      expect(scope.recorder.focusedClients).toEqual([`${ORIGIN}/people`]);
      expect(scope.recorder.openedWindows).toEqual([]);
    });

    it('opens a new window when no tab is open on this origin', async () => {
      scope.setClients([]);

      await dispatchNotificationClick(scope, { url: '/people/person-456' });

      expect(scope.recorder.openedWindows).toEqual(['/people/person-456']);
      expect(scope.recorder.navigatedTo).toEqual([]);
      expect(scope.recorder.focusedClients).toEqual([]);
    });

    it('falls back to /dashboard when data.url is missing', async () => {
      scope.setClients([]);

      await dispatchNotificationClick(scope, {});

      expect(scope.recorder.openedWindows).toEqual(['/dashboard']);
    });

    it('falls back to /dashboard when data is absent entirely', async () => {
      scope.setClients([]);

      await dispatchNotificationClick(scope, undefined);

      expect(scope.recorder.openedWindows).toEqual(['/dashboard']);
    });

    it('skips a cross-origin tab and focuses the same-origin one behind it', async () => {
      scope.setClients([
        { url: 'https://elsewhere.test/whatever', focus: async () => {}, navigate: async () => {} },
        { url: `${ORIGIN}/dashboard`, focus: async () => {}, navigate: async () => {} },
      ]);

      await dispatchNotificationClick(scope, { url: '/people/abc' });

      // Without the origin filter the loop would take the first client it sees,
      // which is the foreign one.
      expect(scope.recorder.focusedClients).toEqual([`${ORIGIN}/dashboard`]);
      expect(scope.recorder.navigatedTo).toEqual(['/people/abc']);
      expect(scope.recorder.openedWindows).toEqual([]);
    });

    it('opens a new window when the only open tab is cross-origin', async () => {
      scope.setClients([{ url: 'https://elsewhere.test/whatever', focus: async () => {}, navigate: async () => {} }]);

      await dispatchNotificationClick(scope, { url: '/people/abc' });

      expect(scope.recorder.focusedClients).toEqual([]);
      expect(scope.recorder.navigatedTo).toEqual([]);
      expect(scope.recorder.openedWindows).toEqual(['/people/abc']);
    });

    it('does not focus a tab whose host merely extends the origin', async () => {
      // Same prefix-check weakness as openWindow's guard: a tab on
      // "https://<origin>.evil.com" starts with the real origin as a string
      // but is not actually same-origin, and must not be focused.
      scope.setClients([{ url: `${ORIGIN}.evil.com/whatever`, focus: async () => {}, navigate: async () => {} }]);

      await dispatchNotificationClick(scope, { url: '/people/abc' });

      expect(scope.recorder.focusedClients).toEqual([]);
      expect(scope.recorder.navigatedTo).toEqual([]);
      expect(scope.recorder.openedWindows).toEqual(['/people/abc']);
    });

    it('falls back to /dashboard rather than opening a cross-origin window', async () => {
      // Unlike client.navigate(), openWindow() is not blocked cross-origin by
      // the platform, so the worker has to validate the target itself before
      // handing it to openWindow. No open tab, so this exercises that branch.
      scope.setClients([]);

      await dispatchNotificationClick(scope, { url: 'https://evil.test/phish' });

      expect(scope.recorder.openedWindows).toEqual(['/dashboard']);
    });

    it('opens a same-origin absolute url as given', async () => {
      scope.setClients([]);

      await dispatchNotificationClick(scope, { url: `${ORIGIN}/people/abc` });

      expect(scope.recorder.openedWindows).toEqual([`${ORIGIN}/people/abc`]);
    });

    it('falls back to /dashboard for a protocol-relative url instead of opening it', async () => {
      // A string prefix check on target.startsWith('/') is fooled by a
      // protocol-relative url: openWindow would resolve it off-origin even
      // though the raw string starts with a slash.
      scope.setClients([]);

      await dispatchNotificationClick(scope, { url: '//evil.test/x' });

      expect(scope.recorder.openedWindows).toEqual(['/dashboard']);
    });

    it('falls back to /dashboard for a hostname that merely extends the origin', async () => {
      // A string prefix check on target.startsWith(self.location.origin) is
      // fooled by an origin extension: "https://<origin>.evil.com" starts
      // with the real origin but is a different host entirely.
      scope.setClients([]);

      await dispatchNotificationClick(scope, { url: `${ORIGIN}.evil.com/x` });

      expect(scope.recorder.openedWindows).toEqual(['/dashboard']);
    });

    it('does not let a rejected navigate become an unhandled rejection', async () => {
      // client.navigate() is fire-and-forget (never returned or awaited by
      // the click handler), so a rejection there does not show up as a
      // rejected waitUntil promise. It only shows up as a process-level
      // 'unhandledRejection' event, which is what this actually has to check.
      scope.setClients([
        {
          url: `${ORIGIN}/people`,
          focus: async () => {},
          navigate: async () => {
            throw new Error('navigation aborted');
          },
        },
      ]);

      const unhandled: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandledRejection);

      try {
        await dispatchNotificationClick(scope, { url: '/people/person-123' });
        // Give the navigate() rejection a chance to surface as unhandled
        // before asserting: Node reports it after the microtask queue drains.
        await new Promise((resolve) => setImmediate(resolve));
      } finally {
        process.off('unhandledRejection', onUnhandledRejection);
      }

      expect(unhandled).toEqual([]);
    });
  });
});

describe('build asset cache is bounded', () => {
  /*
   * The trim is registered through event.waitUntil from INSIDE the
   * respondWith promise chain, so it is queued after dispatchFetch has
   * already snapshotted its pending list. Awaiting a macrotask lets it run,
   * which is also what the real worker does: waitUntil keeps the worker alive
   * past respondWith settling.
   */
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('evicts the oldest chunks once past the ceiling instead of growing forever', async () => {
    // VERSION is a constant, so the activate purge never fires again after
    // the first install: sw.js's bytes do not change between deploys. Every
    // deploy produces a fresh set of content-hashed /_next/static/ URLs, so
    // without a bound the cache grew without limit, held back only by the
    // browser's origin-wide storage eviction, which is just as likely to drop
    // the offline page as an old chunk.
    const scope = loadWorker();

    for (let i = 0; i < 130; i++) {
      const { settled } = dispatchFetch(scope, `${ORIGIN}/_next/static/chunk-${i}.js`);
      await settled;
    }

    await flush();

    const cachedChunks = scope.recorder.puts.filter((url) => url.includes('/_next/static/'));
    expect(cachedChunks).toHaveLength(130);

    // Everything over the ceiling was evicted, oldest first.
    expect(scope.recorder.deletes).toContain('/_next/static/chunk-0.js');
    expect(scope.recorder.deletes).not.toContain('/_next/static/chunk-129.js');
  });

  it('never evicts the offline page or the icons that render it', async () => {
    // The offline page is the entire reason this cache exists. Trading it for
    // a build chunk would give up the one thing that works without a network.
    const scope = loadWorker();
    await dispatchLifecycle(scope, 'install');

    for (let i = 0; i < 130; i++) {
      const { settled } = dispatchFetch(scope, `${ORIGIN}/_next/static/chunk-${i}.js`);
      await settled;
    }

    await flush();

    for (const protectedPath of ['/offline', '/icons/icon-192.png', '/icons/icon-512.png', '/logo.svg']) {
      expect(scope.recorder.deletes).not.toContain(protectedPath);
    }
  });

  it('does not evict anything while under the ceiling', async () => {
    const scope = loadWorker();

    for (let i = 0; i < 10; i++) {
      const { settled } = dispatchFetch(scope, `${ORIGIN}/_next/static/chunk-${i}.js`);
      await settled;
    }

    await flush();

    expect(scope.recorder.deletes).toHaveLength(0);
  });
});
