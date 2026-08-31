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

import { postJson, probeNtfyHealth } from '../../../lib/notifications/outbound';

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

describe('TLS server name', () => {
  // These assert on the options handed to the HTTP client rather than on a
  // completed request: `servername` is consumed inside the TLS handshake, so
  // it is not observable from a receiving server.
  async function captureRequestOptions(url: string): Promise<Record<string, unknown>> {
    const https = (await import('node:https')).default;
    let captured: Record<string, unknown> | undefined;

    const spy = vi.spyOn(https, 'request').mockImplementation(((options: unknown) => {
      captured = options as Record<string, unknown>;
      // postJson wraps client.request in a try/catch and settles with
      // 'unknown', so throwing here ends the call cleanly without a socket.
      throw new Error('captured');
    }) as unknown as typeof https.request);

    try {
      await postJson(url, '{}', {});
    } finally {
      spy.mockRestore();
    }

    if (!captured) throw new Error('https.request was never called');
    return captured;
  }

  it('omits servername for an IPv6 literal host', async () => {
    // Catches reverting the guard to `net.isIP(target.parsed.hostname)`.
    // URL.hostname keeps the brackets for IPv6 and net.isIP returns 0 for
    // that form, so the unstripped version sets servername to the literal
    // '[fd00::1]', an invalid SNI value and exactly the DEP0123 case the
    // guard exists to prevent. It worked for IPv4 and silently did nothing
    // for IPv6.
    const options = await captureRequestOptions('https://[fd00::1]:8443/hook');

    expect(options.servername).toBeUndefined();
  });

  it('omits servername for an IPv4 literal host', async () => {
    const options = await captureRequestOptions('https://192.0.2.10/hook');

    expect(options.servername).toBeUndefined();
  });

  it('still sets servername for a real hostname', async () => {
    // The other half: stripping brackets must not disable SNI for the normal
    // name-based case, which is what makes virtual hosts work.
    mocks.resolve4.mockResolvedValue(['93.184.216.34']);
    mocks.resolve6.mockRejectedValue(new Error('no AAAA'));

    const options = await captureRequestOptions('https://hook.example.com/x');

    expect(options.servername).toBe('hook.example.com');
  });
});

describe('expectJsonResponse', () => {
  it('treats a 2xx with a non-JSON content type as unexpected_response', async () => {
    // The #437 case: a mistyped ntfy URL pointing at an ordinary web server
    // that happily returns 200 with an HTML body. Without this the delivery
    // counts as a success, the reminder is stamped, and it is never retried.
    handler = (_req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html></html>');

    const result = await postJson(`${base}/`, '{}', {}, { expectJsonResponse: true });

    expect(result).toEqual({ ok: false, code: 'unexpected_response' });
  });

  it('accepts a 2xx with application/json', async () => {
    handler = (_req, res) =>
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"id":"abc"}');

    const result = await postJson(`${base}/`, '{}', {}, { expectJsonResponse: true });

    expect(result).toEqual({ ok: true });
  });

  it('accepts a JSON content type carrying a charset parameter', async () => {
    handler = (_req, res) =>
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end('{}');

    const result = await postJson(`${base}/`, '{}', {}, { expectJsonResponse: true });

    expect(result).toEqual({ ok: true });
  });

  it('treats a 2xx with no content type at all as unexpected_response', async () => {
    handler = (_req, res) => res.writeHead(204).end();

    const result = await postJson(`${base}/`, '{}', {}, { expectJsonResponse: true });

    expect(result).toEqual({ ok: false, code: 'unexpected_response' });
  });

  it('leaves callers that did not opt in unaffected', async () => {
    // Webhooks deliberately accept any 2xx: a receiver is free to answer with
    // an empty body. Only ntfy opts in, because only ntfy has a documented
    // response shape to check against.
    handler = (_req, res) => res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');

    const result = await postJson(`${base}/`, '{}', {});

    expect(result).toEqual({ ok: true });
  });

  it('still reports a non-2xx by its status, not as unexpected_response', async () => {
    handler = (_req, res) => res.writeHead(503, { 'Content-Type': 'text/html' }).end('nope');

    const result = await postJson(`${base}/`, '{}', {}, { expectJsonResponse: true });

    expect(result).toEqual({ ok: false, code: 'http_5xx' });
  });
});

describe('probeNtfyHealth', () => {
  it('accepts a server that reports healthy', async () => {
    handler = (_req, res) =>
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"healthy":true}');

    await expect(probeNtfyHealth(`${base}/`)).resolves.toBe('ntfy');
  });

  it('rejects a server that answers 200 but is not ntfy', async () => {
    handler = (_req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html></html>');

    await expect(probeNtfyHealth(`${base}/`)).resolves.toBe('not_ntfy');
  });

  it('rejects a server that reports unhealthy', async () => {
    handler = (_req, res) =>
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"healthy":false}');

    await expect(probeNtfyHealth(`${base}/`)).resolves.toBe('not_ntfy');
  });

  it('rejects a 404, which is what a non-ntfy host usually gives for /v1/health', async () => {
    handler = (_req, res) => res.writeHead(404).end();

    await expect(probeNtfyHealth(`${base}/`)).resolves.toBe('not_ntfy');
  });

  it('does not buffer an unbounded body', async () => {
    // A hostile or broken host must not be able to stream arbitrary data into
    // memory. The probe gives up past its byte ceiling rather than reading on.
    handler = (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('x'.repeat(200_000));
    };

    await expect(probeNtfyHealth(`${base}/`)).resolves.toBe('not_ntfy');
  });

  it('reports a connection failure as unreachable, not as a wrong server', async () => {
    // The distinction that decides whether the save is refused. Collapsing
    // this into not_ntfy told a user "no ntfy server answered, check the
    // URL" for a resolver hiccup, and hard-blocked any ntfy whose /v1/health
    // this app cannot reach even though publishing to it works.
    await expect(probeNtfyHealth('http://127.0.0.1:1/')).resolves.toBe('unreachable');
  });

  it('reports a stalled connection as unreachable', async () => {
    await expect(probeNtfyHealth(`${trickleBase}/`)).resolves.toBe('unreachable');
  }, 10_000);
});

describe('probeNtfyHealth gating', () => {
  it('refuses a save only on a conclusive not_ntfy, never on unreachable', async () => {
    // Pins the asymmetry directly, so a future change that starts refusing
    // on 'unreachable' fails here rather than in a self-hoster's bug report.
    const { checkEndpointUrl } = await import('../../../lib/notifications/endpoint-url');

    mocks.resolve4.mockResolvedValue(['127.0.0.1']);
    mocks.resolve6.mockRejectedValue(new Error('no AAAA'));

    handler = (_req, res) => res.writeHead(404).end();
    const wrongHost = await checkEndpointUrl({ url: `${base}/topic`, ntfyBase: `${base}/` });
    expect(wrongHost).toEqual({ code: 'not_ntfy' });

    const unreachable = await checkEndpointUrl({
      url: 'http://127.0.0.1:1/topic',
      ntfyBase: 'http://127.0.0.1:1/',
    });
    expect(unreachable).toBeNull();
  });
});
