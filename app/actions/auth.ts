'use server';

import { signOut } from '@/lib/auth';
import { blacklistToken } from '@/lib/token-blacklist';
import { logger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

export async function handleSignOut() {
  try {
    // Get the JWT token from cookies
    const cookieStore = await cookies();
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

    if (!secret) {
      logger.error('AUTH_SECRET not configured');
    } else {
      try {
        const cookieHeader = cookieStore
          .getAll()
          .map(({ name, value }) => `${name}=${value}`)
          .join('; ');
        const token = await getToken({
          req: { headers: { cookie: cookieHeader } } as unknown as Request,
          secret,
        });

        if (token?.jti) {
          const defaultMaxAgeMs = 30 * 24 * 60 * 60 * 1000;
          const expiresAtMs = typeof token.exp === 'number'
            ? token.exp * 1000
            : Date.now() + defaultMaxAgeMs;
          const expiresAt = new Date(expiresAtMs);

          // Blacklist the token
          await blacklistToken(token.jti, expiresAt);

          logger.info('Token blacklisted on logout', {
            userId: token.id,
            jti: token.jti,
          });
        }
      } catch (decodeError) {
        logger.error('Failed to decode and blacklist token', {}, decodeError as Error);
        // Continue with logout even if blacklisting fails
      }
    }
  } catch (error) {
    logger.error('Error during logout', {}, error as Error);
    // Continue with logout even if blacklisting fails
  }

  await signOut({ redirectTo: '/login' });
}
