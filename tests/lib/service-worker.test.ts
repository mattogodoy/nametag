import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SW_SOURCE = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');

type Handler = (event: FakeEvent) => void;

interface FakeEvent {
  request: { url: string; method: string; mode: string };
  respondWith: (value: unknown) => void;
  waitUntil: (value: unknown) => void;
}

/** Executes public/sw.js against a minimal stub scope and returns its handlers. */
function loadWorker(): Map<string, Handler> {
  const handlers = new Map<string, Handler>();

  const workerSelf = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    location: { origin: 'https://nametag.test' },
  };

  const workerCaches = {
    open: () =>
      Promise.resolve({
        addAll: () => Promise.resolve(),
        add: () => Promise.resolve(),
        match: () => Promise.resolve(undefined),
        put: () => Promise.resolve(),
      }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
  };

  // sw.js is a plain script, not a module, so it cannot be imported. Running it
  // in a stub scope is the only way to exercise the real routing logic.
  // (No eslint-disable needed: this project enables neither no-implied-eval nor
  // no-new-func, and an unused disable directive is itself a lint warning.)
  const factory = new Function('self', 'caches', 'fetch', 'URL', 'Response', SW_SOURCE);
  factory(workerSelf, workerCaches, () => Promise.resolve(new Response('ok')), URL, Response);

  return handlers;
}

/** Returns the event plus a separate flag object, so nothing self-references. */
function makeEvent(url: string, init: { method?: string; mode?: string } = {}): {
  event: FakeEvent;
  state: { responded: boolean };
} {
  const state = { responded: false };
  const event: FakeEvent = {
    request: {
      url,
      method: init.method ?? 'GET',
      mode: init.mode ?? 'no-cors',
    },
    respondWith: () => {
      state.responded = true;
    },
    waitUntil: () => {},
  };
  return { event, state };
}

describe('public/sw.js', () => {
  let handlers: Map<string, Handler>;

  beforeEach(() => {
    handlers = loadWorker();
  });

  it('registers the four lifecycle handlers', () => {
    expect([...handlers.keys()].sort()).toEqual(['activate', 'fetch', 'install', 'message']);
  });

  it('declares a versioned cache name', () => {
    expect(SW_SOURCE).toMatch(/nametag-static-v\d+/);
  });

  it('precaches the offline page', () => {
    expect(SW_SOURCE).toContain('/offline');
  });

  describe('fetch routing', () => {
    const dispatch = (url: string, init?: { method?: string; mode?: string }) => {
      const { event, state } = makeEvent(url, init);
      handlers.get('fetch')?.(event);
      return state.responded;
    };

    it('intercepts navigations so it can serve the offline page', () => {
      expect(dispatch('https://nametag.test/people', { mode: 'navigate' })).toBe(true);
    });

    it('intercepts immutable build output', () => {
      expect(dispatch('https://nametag.test/_next/static/chunks/main.js')).toBe(true);
    });

    it('intercepts its own icons', () => {
      expect(dispatch('https://nametag.test/icons/icon-192.png')).toBe(true);
    });

    // The privacy-critical rules. A regression here would put contact data on
    // disk in the browser cache.
    it('never intercepts API requests', () => {
      expect(dispatch('https://nametag.test/api/people')).toBe(false);
      expect(dispatch('https://nametag.test/api/photos/abc')).toBe(false);
      expect(dispatch('https://nametag.test/api/people', { mode: 'navigate' })).toBe(false);
    });

    it('never intercepts optimised images', () => {
      expect(dispatch('https://nametag.test/_next/image?url=%2Ffoo.png')).toBe(false);
    });

    it('never intercepts non-GET requests', () => {
      expect(dispatch('https://nametag.test/people', { method: 'POST', mode: 'navigate' })).toBe(false);
      expect(dispatch('https://nametag.test/people', { method: 'DELETE' })).toBe(false);
    });

    it('never intercepts cross-origin requests', () => {
      expect(dispatch('https://tiles.openfreemap.org/styles/liberty')).toBe(false);
    });

    it('does not intercept ordinary same-origin paths it has no rule for', () => {
      expect(dispatch('https://nametag.test/robots.txt')).toBe(false);
    });
  });
});
