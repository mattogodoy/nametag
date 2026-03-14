import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';
import {
  AUTH_PROVIDER,
  isAuthProviderEnabled,
  isOAuthProvider,
} from '@/lib/auth-providers';

function getClaimValue(
  profile: Record<string, unknown>,
  claimKey: string,
): string | null {
  const value = profile[claimKey];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mapOAuthProfile(
  provider: string,
  profileClaims: Record<string, unknown>,
  user: {
    name?: string | null;
    nickname?: string | null;
    image?: string | null;
  },
): {
  mappedName: string | null;
  mappedSurname: string | null;
  mappedNickname: string | null;
  mappedPhoto: string | null;
} {
  switch (provider) {
    case AUTH_PROVIDER.GOOGLE:
      return {
        mappedName:
          (profileClaims.given_name as string | undefined) ||
          user.name ||
          'User',
        mappedSurname:
          (profileClaims.family_name as string | undefined) || null,
        mappedNickname: user.nickname || null,
        mappedPhoto: user.image || null,
      };
    case AUTH_PROVIDER.OIDC:
      return {
        mappedName: getClaimValue(profileClaims, env.OIDC_MAPPING_NAME),
        mappedSurname: getClaimValue(profileClaims, env.OIDC_MAPPING_LASTNAME),
        mappedNickname: getClaimValue(profileClaims, env.OIDC_MAPPING_NICKNAME),
        mappedPhoto: getClaimValue(profileClaims, env.OIDC_MAPPING_AVATAR),
      };
    default:
      // Default branch keeps future providers straightforward (e.g. github).
      return {
        mappedName: user.name || 'User',
        mappedSurname: null,
        mappedNickname: user.nickname || null,
        mappedPhoto: user.image || null,
      };
  }
}

// Build providers list based on mode
const providers = [
  ...(isAuthProviderEnabled(AUTH_PROVIDER.CREDENTIALS)
    ? [
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
            const { normalizeEmail } = await import('@/lib/api-utils');

            if (!credentials?.email || !credentials?.password) {
              return null;
            }

            // Normalize email to lowercase for case-insensitive lookup
            const email = normalizeEmail(credentials.email as string);

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

            const passwordMatch = await bcrypt.compare(
              credentials.password as string,
              user.password,
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
              photo: user.photo,
            };
          },
        }),
      ]
    : []),
  // Add Google provider only in SaaS mode
  ...(isAuthProviderEnabled(AUTH_PROVIDER.GOOGLE)
    ? [
        Google({
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        }),
      ]
    : []),
  ...(isAuthProviderEnabled(AUTH_PROVIDER.OIDC)
    ? [
        {
          id: AUTH_PROVIDER.OIDC,
          name: env.OIDC_DISPLAY_NAME || 'OIDC Provider',
          type: 'oidc' as const,
          issuer: env.OIDC_ISSUER_URL,
          clientId: env.OIDC_CLIENT_ID,
          clientSecret: env.OIDC_CLIENT_SECRET,
          checks: env.OIDC_PKCE
            ? (['pkce'] as ('pkce' | 'state' | 'nonce' | 'none')[])
            : (['state'] as ('pkce' | 'state' | 'nonce' | 'none')[]),
          authorization: {
            params: {
              scope: env.OIDC_SCOPE || 'openid profile email',
              ...(env.OIDC_PKCE
                ? { code_challenge_method: env.OIDC_PKCE_METHOD }
                : {}),
            },
          },
        },
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
      if (isOAuthProvider(account?.provider) && profile) {
        const { prisma } = await import('@/lib/prisma');
        const { createFreeSubscription } = await import('@/lib/billing');
        const { createPreloadedRelationshipTypes } =
          await import('@/lib/relationship-types');
        const { normalizeEmail } = await import('@/lib/api-utils');

        if (!user.email || !account.providerAccountId) {
          return false;
        }

        const profileClaims = profile as Record<string, unknown>;
        const { mappedName, mappedSurname, mappedNickname, mappedPhoto } =
          mapOAuthProfile(account.provider, profileClaims, user);

        // Normalize email to lowercase for case-insensitive lookup
        const email = normalizeEmail(user.email);

        // Check if user exists with this email
        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          const updateData: {
            provider?: string;
            providerAccountId?: string;
            emailVerified?: boolean;
            name?: string;
            surname?: string;
            nickname?: string;
            photo?: string;
          } = {};

          // If user exists but doesn't have OAuth linked, link it.
          if (!existingUser.provider || !existingUser.providerAccountId) {
            updateData.provider = account.provider;
            updateData.providerAccountId = account.providerAccountId;
            updateData.emailVerified = true; // OAuth emails are pre-verified
          }

          // OIDC profile sync can be disabled to prevent overwriting user-edited fields.
          if (
            account.provider === AUTH_PROVIDER.OIDC &&
            env.OIDC_SYNC_PROFILE
          ) {
            if (mappedName) updateData.name = mappedName;
            if (mappedSurname) updateData.surname = mappedSurname;
            if (mappedNickname) updateData.nickname = mappedNickname;
            if (mappedPhoto) updateData.photo = mappedPhoto;
          }

          // Keep the previous Google behavior: only backfill photo when empty.
          if (
            account.provider === AUTH_PROVIDER.GOOGLE &&
            !existingUser.photo &&
            mappedPhoto
          ) {
            updateData.photo = mappedPhoto;
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: updateData,
            });
          }
          // Update user object with existing user's ID for JWT callback
          user.id = existingUser.id;
        } else {
          // Create new user with OAuth
          const newUser = await prisma.user.create({
            data: {
              email,
              name: mappedName || user.name || 'User',
              surname: mappedSurname,
              nickname: mappedNickname,
              photo: mappedPhoto,
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
