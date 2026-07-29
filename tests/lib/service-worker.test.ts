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
}

interface FakeEvent {
  request?: FakeRequest;
  data?: { type?: string };
  respondWith: (value: unknown) => void;
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
}

interface Scope {
  handlers: Map<string, Handler>;
  recorder: Recorder;
}

function keyOf(target: FakeRequest | string): string {
  const raw = typeof target === 'string' ? target : target.url;
  const parsed = new URL(raw, ORIGIN);
  return parsed.pathname + parsed.search;
}

/** Executes public/sw.js against a stub scope that records cache writes. */
function loadWorker(): Scope {
  const handlers = new Map<string, Handler>();
  const recorder: Recorder = { adds: [], puts: [] };
  const store = new Map<string, unknown>();

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
  };

  const workerSelf = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    location: { origin: ORIGIN },
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

  return { handlers, recorder };
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
  init: { method?: string; mode?: string } = {}
): { responded: boolean; settled: Promise<unknown> } {
  const pending: Promise<unknown>[] = [];
  let responded = false;

  const event: FakeEvent = {
    request: {
      url,
      method: init.method ?? 'GET',
      mode: init.mode ?? 'no-cors',
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

describe('public/sw.js', () => {
  let scope: Scope;

  beforeEach(() => {
    scope = loadWorker();
  });

  it('registers the four lifecycle handlers', () => {
    expect([...scope.handlers.keys()].sort()).toEqual([
      'activate',
      'fetch',
      'install',
      'message',
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
});
