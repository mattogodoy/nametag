import http, { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createNametagMcpServer } from './server';
type McpHttpServerOptions = {
  path?: string;
  requireAuth?: boolean;
  apiBaseUrl?: string;
};

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw);
}

export function createMcpHttpServer(options: McpHttpServerOptions = {}): http.Server {
  const path = options.path ?? '/mcp';
  const apiBaseUrl = options.apiBaseUrl ?? process.env.MCP_API_BASE_URL ?? 'http://127.0.0.1:3000';
  const requireAuth =
    options.requireAuth ??
    (process.env.MCP_REQUIRE_AUTH === 'true' || process.env.NODE_ENV === 'production');

  return http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url || !req.url.startsWith(path)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader && requireAuth) {
      res.statusCode = 401;
      res.end('Unauthorized');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405).end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Method not allowed.',
          },
          id: null,
        })
      );
      return;
    }

    let parsedBody: unknown = undefined;

    try {
      parsedBody = await readJsonBody(req);
    } catch (error) {
      res.statusCode = 400;
      res.end('Invalid JSON body');
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createNametagMcpServer({
      apiBaseUrl,
      authHeader: authHeader ?? undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          })
        );
      }
    } finally {
      res.on('close', () => {
        transport.close();
        server.close();
      });
    }
  });
}
