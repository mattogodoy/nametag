import 'dotenv/config';
import { createMcpHttpServer } from '../lib/mcp/httpServer';

const port = Number(process.env.MCP_PORT ?? 3333);
const host = process.env.MCP_HOST ?? '127.0.0.1';
const requireAuthEnv = process.env.MCP_REQUIRE_AUTH;
const requireAuth = requireAuthEnv ? requireAuthEnv === 'true' : undefined;

const server = createMcpHttpServer({
  path: '/mcp',
  requireAuth,
});

server.listen(port, host, (error?: Error) => {
  if (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }

  console.log(`Nametag MCP server listening on http://${host}:${port}/mcp`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
