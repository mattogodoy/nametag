import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';
import { isSaasMode } from '@/lib/features';

// Build providers list based on mode
const providers = [
  CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Lazy load Prisma and bcrypt to avoid edge runtime issues
        const { prisma } = await import('@/lib/prisma');
        const bcrypt = await import('bcryptjs');
        const { isFeatureEnabled } = await import('@/lib/features');

        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        });

        if (!user) {
          return null;
        }

        // OAuth users don't have passwords - they must use OAuth to sign in
        if (!user.password) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

        // Check if email is verified (only in SaaS mode)
        if (isFeatureEnabled('emailVerification') && !user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        // Update last login timestamp
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          surname: user.surname,
          nickname: user.nickname,
        };
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

        // Check if user exists with this email
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
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
              email: user.email!,
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
