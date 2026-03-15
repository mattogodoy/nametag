import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';
import { isSaasMode } from '@/lib/features';
import { createModuleLogger } from '@/lib/logger';
import { normalizeLocale } from '@/lib/locale';

const log = createModuleLogger('auth');

export const MAX_FAILED_ATTEMPTS = 10;
export const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function authorizeCredentials(credentials: {
  email?: string;
  password?: string;
}): Promise<{ id: string; email: string; name: string; surname: string | null; nickname: string | null; photo: string | null } | null> {
  // Lazy load Prisma and bcrypt to avoid edge runtime issues
  const { prisma } = await import('@/lib/prisma');
  const bcrypt = await import('bcryptjs');
  const { isFeatureEnabled } = await import('@/lib/features');
  const { normalizeEmail } = await import('@/lib/api-utils');

  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  // Normalize email to lowercase for case-insensitive lookup
  const email = normalizeEmail(credentials.email);

  const user = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!user) {
    return null;
  }

  // OAuth users don't have passwords - they must use OAuth to sign in
  if (!user.password) {
    return null;
  }

  // Check if account is currently locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error('ACCOUNT_LOCKED');
  }

  const passwordMatch = await bcrypt.compare(
    credentials.password,
    user.password
  );

  if (!passwordMatch) {
    // Increment failed login attempts
    const newAttempts = user.failedLoginAttempts + 1;
    const updateData: { failedLoginAttempts: { increment: number }; lockedUntil?: Date } = {
      failedLoginAttempts: { increment: 1 },
    };

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

      // Send lockout notification email (non-blocking)
      const locale = normalizeLocale(user.language || 'en');
      import(`@/locales/${locale}.json`).then((messages) => {
        const lockoutMessages = messages.auth?.accountLocked;
        const subject = lockoutMessages?.subject || 'Account temporarily locked';
        const text = lockoutMessages?.body || 'Your account has been temporarily locked due to too many failed login attempts. It will be automatically unlocked in 30 minutes. If you did not attempt to log in, please reset your password immediately.';
        const html = `<p>${text.replace(/\n/g, '</p><p>')}</p>`;
        return import('@/lib/email').then(({ sendEmail }) =>
          sendEmail({ to: user.email, subject, html, text })
        );
      }).catch((err: unknown) => {
        log.warn({ err: err instanceof Error ? err : new Error(String(err)), email: user.email }, 'Failed to send lockout notification email');
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return null;
  }

  // Check if email is verified (only in SaaS mode)
  if (isFeatureEnabled('emailVerification') && !user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED');
  }

  // Successful login — reset failed attempts and update last login
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    nickname: user.nickname,
    photo: user.photo,
  };
}

// Build providers list based on mode
const providers = [
  CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        return authorizeCredentials(credentials as { email?: string; password?: string });
      },
    }),
  // Add Google provider only in SaaS mode
  ...(isSaasMode() && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? [
        Google({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Trust host header in production (required for Docker/proxy deployments)
  trustHost: true,

  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle OAuth sign-in
      if (account?.provider === 'google' && profile) {
        const { prisma } = await import('@/lib/prisma');
        const { createFreeSubscription } = await import('@/lib/billing');
        const { createPreloadedRelationshipTypes } = await import('@/lib/relationship-types');
        const { normalizeEmail } = await import('@/lib/api-utils');

        // Normalize email to lowercase for case-insensitive lookup
        const email = normalizeEmail(user.email!);

        // Check if user exists with this email
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // If user exists but doesn't have OAuth linked, link it
          if (!existingUser.provider || !existingUser.providerAccountId) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                emailVerified: true, // OAuth emails are pre-verified
              },
            });
          }
          // Update user object with existing user's ID for JWT callback
          user.id = existingUser.id;
        } else {
          // Create new user with OAuth
          const newUser = await prisma.user.create({
            data: {
              email,
              name: profile.given_name || user.name || 'User',
              surname: profile.family_name || null,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              emailVerified: true, // OAuth emails are pre-verified
            },
          });

          // Create free subscription
          await createFreeSubscription(newUser.id);

          // Create pre-loaded relationship types
          await createPreloadedRelationshipTypes(prisma, newUser.id);

          // Update user object with new user's ID for JWT callback
          user.id = newUser.id;
        }
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.surname = user.surname;
        token.nickname = user.nickname;
        token.email = user.email;
        token.photo = user.photo;
      }
      // Ensure jti exists for blacklist tracking (even on existing sessions)
      if (!token.jti) {
        token.jti = randomUUID();
      }
      // Update token when session is updated
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.surname = session.surname;
        token.nickname = session.nickname;
        token.email = session.email;
        if (session.photo !== undefined) {
          token.photo = session.photo;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Check if token is blacklisted (logged out)
      if (token.jti) {
        const { isTokenBlacklisted } = await import('@/lib/token-blacklist');
        const blacklisted = await isTokenBlacklisted(token.jti as string);
        if (blacklisted) {
          // Return session with cleared user to invalidate it
          // This makes auth() return null and redirects to login
          return {
            ...session,
            user: undefined as unknown as typeof session.user,
          };
        }
      }

      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string | null;
        session.user.surname = token.surname as string | null;
        session.user.nickname = token.nickname as string | null;
        session.user.email = token.email as string;
        session.user.photo = token.photo as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Refresh every 24 hours
  },
});
