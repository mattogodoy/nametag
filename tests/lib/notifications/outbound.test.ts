import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({ isSaasMode: vi.fn(() => false) }));
vi.mock('../../../lib/features', () => ({ isSaasMode: mocks.isSaasMode }));

import { postJson } from '../../../lib/notifications/outbound';

let server: http.Server;
let base: string;
let lastRequest: { headers: http.IncomingHttpHeaders; body: string } | null = null;
let handler: (req: http.IncomingMessage, res: http.ServerResponse) => void;

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
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
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
});
