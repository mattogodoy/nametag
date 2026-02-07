import 'dotenv/config';
import { createMcpHttpServer } from '../lib/mcp/httpServer';

async function run() {
  const authServer = createMcpHttpServer({ requireAuth: true });

  await new Promise<void>((resolve, reject) => {
    authServer.listen(0, '127.0.0.1', () => resolve());
    authServer.once('error', (err) => reject(err));
  });

  const authAddress = authServer.address();
  if (!authAddress || typeof authAddress === 'string') {
    throw new Error('Failed to determine server address');
  }

  const authUrl = `http://127.0.0.1:${authAddress.port}/mcp`;
  const authResponse = await fetch(authUrl, { method: 'GET' });

  if (authResponse.status !== 401) {
    throw new Error(`Unexpected auth status code: ${authResponse.status}`);
  }

  authServer.close();

  const openServer = createMcpHttpServer({ requireAuth: false });

  await new Promise<void>((resolve, reject) => {
    openServer.listen(0, '127.0.0.1', () => resolve());
    openServer.once('error', (err) => reject(err));
  });

  const openAddress = openServer.address();
  if (!openAddress || typeof openAddress === 'string') {
    throw new Error('Failed to determine server address');
  }

  const openUrl = `http://127.0.0.1:${openAddress.port}/mcp`;
  const response = await fetch(openUrl, { method: 'GET' });

  if (response.status !== 405) {
    throw new Error(`Unexpected status code: ${response.status}`);
  }

  openServer.close();
  console.log('MCP smoke test passed.');
}

run().catch((error) => {
  console.error('MCP smoke test failed:', error);
  process.exit(1);
});
