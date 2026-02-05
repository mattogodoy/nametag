import type { IncomingMessage } from 'node:http';
import { getToken } from 'next-auth/jwt';
import { env } from '../env';

type McpAuthMethod = 'nextauth' | 'token' | 'default' | 'none';

export type McpAuthContext = {
  userId: string | null;
  method: McpAuthMethod;
  error?: string;
};

export type McpAuthOptions = {
  authToken?: string;
  defaultUserId?: string;
  requireAuth: boolean;
};

function getBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
}

export async function resolveMcpAuth(
  req: IncomingMessage,
  options: McpAuthOptions
): Promise<McpAuthContext> {
  const nextAuthToken = await getToken({
    req: req as unknown as Request,
    secret: env.NEXTAUTH_SECRET,
  });

  if (nextAuthToken && typeof nextAuthToken.id === 'string') {
    return { userId: nextAuthToken.id, method: 'nextauth' };
  }

  const bearer = getBearerToken(req);
  if (options.authToken && bearer && bearer === options.authToken) {
    if (!options.defaultUserId) {
      return {
        userId: null,
        method: 'token',
        error: 'MCP_DEFAULT_USER_ID must be set when using MCP_AUTH_TOKEN.',
      };
    }

    return { userId: options.defaultUserId, method: 'token' };
  }

  if (!options.requireAuth && options.defaultUserId) {
    return { userId: options.defaultUserId, method: 'default' };
  }

  return { userId: null, method: 'none' };
}
