import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({
  isSaasMode: vi.fn(() => false),
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));
vi.mock('../../../lib/features', () => ({ isSaasMode: mocks.isSaasMode }));
vi.mock('dns', () => ({
  default: { promises: { resolve4: mocks.resolve4, resolve6: mocks.resolve6 } },
  promises: { resolve4: mocks.resolve4, resolve6: mocks.resolve6 },
}));

import { postJson } from '../../../lib/notifications/outbound';

let server: http.Server;
let base: string;
let lastRequest: { headers: http.IncomingHttpHeaders; body: string } | null = null;
let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

// A raw TCP server that never speaks HTTP, used to force real transport-level
// failures (a stalled/trickling connection, a broken TLS handshake) that a
// mocked client could not produce.
let trickleServer: net.Server;
let trickleBase: string;

let brokenTlsServer: net.Server;
let brokenTlsBase: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      lastRequest = { headers: req.headers, body };
      handler(req, res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  trickleServer = net.createServer((socket) => {
    // Trickle a *valid* HTTP response, one byte every 2s, forever. Each byte
    // is a legal continuation of the one before it, so the HTTP parser never
    // errors, it just keeps waiting for the rest. Each byte also resets the
    // socket's inactivity timer (the `timeout` option), so that timer alone
    // never fires either. Only a total deadline independent of socket
    // activity can end this before the headers would eventually complete.
    const headerText = 'HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n';
    let index = 0;
    // The client destroys its end once the deadline fires; a write racing
    // that teardown throws EPIPE, which is expected here and not a test
    // failure, so it needs somewhere to land.
    socket.on('error', () => {
      /* the client closed first; nothing to do */
    });
    const interval = setInterval(() => {
      if (socket.destroyed || !socket.writable || index >= headerText.length) return;
      socket.write(headerText[index]);
      index++;
    }, 2000);
    socket.on('close', () => clearInterval(interval));
  });
  await new Promise<void>((resolve) => trickleServer.listen(0, '127.0.0.1', resolve));
  trickleBase = `http://127.0.0.1:${(trickleServer.address() as AddressInfo).port}`;

  brokenTlsServer = net.createServer((socket) => {
    socket.on('data', () => {
      socket.write('NOT-TLS-DATA');
    });
  });
  await new Promise<void>((resolve) => brokenTlsServer.listen(0, '127.0.0.1', resolve));
  brokenTlsBase = `https://127.0.0.1:${(brokenTlsServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await Promise.all([
    new Promise<void>((resolve) => server.close(() => resolve())),
    new Promise<void>((resolve) => trickleServer.close(() => resolve())),
    new Promise<void>((resolve) => brokenTlsServer.close(() => resolve())),
  ]);
});

describe('postJson', () => {
  it('posts the body and the given headers', async () => {
    handler = (_req, res) => res.writeHead(200).end('ok');

    const result = await postJson(`${base}/hook`, '{"a":1}', { 'X-Test': 'yes' });

    expect(result).toEqual({ ok: true });
    expect(lastRequest?.body).toBe('{"a":1}');
    expect(lastRequest?.headers['x-test']).toBe('yes');
    expect(lastRequest?.headers['content-type']).toBe('application/json');
    expect(lastRequest?.headers['content-length']).toBe('7');
  });

  it('sends a Host header derived from the URL, not the pinned IP', async () => {
    handler = (_req, res) => res.writeHead(204).end();

    await postJson(`${base}/hook`, '{}', {});

    expect(lastRequest?.headers.host).toContain('127.0.0.1');
  });

  it('treats any 2xx as success', async () => {
    handler = (_req, res) => res.writeHead(202).end();

    expect(await postJson(`${base}/hook`, '{}', {})).toEqual({ ok: true });
  });

  it('does NOT follow redirects and reports them distinctly', async () => {
    let hits = 0;
    handler = (_req, res) => {
      hits++;
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' }).end();
    };

    const result = await postJson(`${base}/hook`, '{}', {});

    expect(result).toEqual({ ok: false, code: 'redirect' });
    expect(hits).toBe(1);
  });

  it('categorizes a 4xx', async () => {
    handler = (_req, res) => res.writeHead(403).end();

    expect(await postJson(`${base}/hook`, '{}', {})).toEqual({ ok: false, code: 'http_4xx' });
  });

  it('categorizes a 5xx', async () => {
    handler = (_req, res) => res.writeHead(502).end();

    expect(await postJson(`${base}/hook`, '{}', {})).toEqual({ ok: false, code: 'http_5xx' });
  });

  it('categorizes a 429 distinctly from the rest of 4xx', async () => {
    // A destination's own rate limit is not a rejection of the request's
    // content, and the UI shows a different message for it (and health
    // tracking excludes it from auto-disable), so it must not collapse into
    // the generic http_4xx bucket.
    handler = (_req, res) => res.writeHead(429).end();

    expect(await postJson(`${base}/hook`, '{}', {})).toEqual({ ok: false, code: 'http_429' });
  });

  it('never returns the response body, so it cannot be used as a read oracle', async () => {
    handler = (_req, res) => res.writeHead(200).end('SECRET-INTERNAL-DATA');

    const result = await postJson(`${base}/hook`, '{}', {});

    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(Object.keys(result)).toEqual(['ok']);
  });

  it('reports refused for a closed port', async () => {
    const result = await postJson('http://127.0.0.1:1/hook', '{}', {});

    expect(result).toEqual({ ok: false, code: 'refused' });
  });

  it('reports blocked for a non-HTTP protocol', async () => {
    expect(await postJson('file:///etc/passwd', '{}', {})).toEqual({ ok: false, code: 'blocked' });
  });

  it('reports blocked for an internal address in SaaS mode', async () => {
    mocks.isSaasMode.mockReturnValue(true);

    const result = await postJson(`${base}/hook`, '{}', {});

    expect(result).toEqual({ ok: false, code: 'blocked' });
    mocks.isSaasMode.mockReturnValue(false);
  });

  it('reports timeout when the server never responds', async () => {
    handler = () => {
      /* deliberately never responds */
    };

    const result = await postJson(`${base}/slow`, '{}', {});

    expect(result).toEqual({ ok: false, code: 'timeout' });
  }, 15000);

  it('reports timeout for a connection that trickles bytes forever, not just one that stays silent', async () => {
    // A byte every 2s keeps the socket's inactivity timer from ever firing on
    // its own. Only a total deadline independent of activity ends this.
    const result = await postJson(`${trickleBase}/trickle`, '{}', {});

    expect(result).toEqual({ ok: false, code: 'timeout' });
  }, 15000);

  it('resolves rather than rejects when a header value is invalid, e.g. contains a CRLF', async () => {
    const result = await postJson(`${base}/hook`, '{}', { 'X-Bad': 'value\r\ninjected: true' });

    expect(result).toEqual({ ok: false, code: 'unknown' });
  });

  it('resolves rather than rejects when a header value has non-latin1 characters', async () => {
    const result = await postJson(`${base}/hook`, '{}', { 'X-Bad': 'you good 🎂' });

    expect(result).toEqual({ ok: false, code: 'unknown' });
  });

  it('reports dns for a hostname that fails to resolve, distinct from a policy rejection', async () => {
    mocks.resolve4.mockRejectedValue(Object.assign(new Error('NXDOMAIN'), { code: 'ENOTFOUND' }));
    mocks.resolve6.mockRejectedValue(Object.assign(new Error('NXDOMAIN'), { code: 'ENOTFOUND' }));

    const result = await postJson('http://does-not-resolve.test/hook', '{}', {});

    expect(result).toEqual({ ok: false, code: 'dns' });
  });

  it('pins the socket to the address resolveTarget approved, and keeps the Host header name-based', async () => {
    const port = (server.address() as AddressInfo).port;
    // "pinned.test" is not a domain that exists; a real DNS lookup of it
    // fails with ENOTFOUND. The only way this reaches our loopback listener
    // at all is through the pinned `lookup` override, which answers with
    // 127.0.0.1 regardless of what is actually asked for.
    mocks.resolve4.mockResolvedValue(['127.0.0.1']);
    mocks.resolve6.mockRejectedValue(Object.assign(new Error('no AAAA'), { code: 'ENODATA' }));
    handler = (_req, res) => res.writeHead(200).end();

    const result = await postJson(`http://pinned.test:${port}/`, '{}', {});

    expect(result).toEqual({ ok: true });
    expect(lastRequest?.headers.host).toBe(`pinned.test:${port}`);
  });

  it('categorizes a broken TLS handshake distinctly from a refused connection', async () => {
    const result = await postJson(`${brokenTlsBase}/hook`, '{}', {});

    expect(result).toEqual({ ok: false, code: 'tls' });
  }, 10000);
});
