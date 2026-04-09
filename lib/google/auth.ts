import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { GoogleIntegration } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { encryptPassword, decryptPassword } from '@/lib/carddav/encryption';
import { createModuleLogger } from '@/lib/logger';
import fs from 'fs';

const log = createModuleLogger('google-auth');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

/**
 * Token expiry buffer: refresh tokens 5 minutes before they actually expire
 * to avoid race conditions with in-flight requests.
 */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GoogleAuthResult = {
  auth: OAuth2Client;
  integration: GoogleIntegration;
};

// ---------------------------------------------------------------------------
// getGoogleIntegration
// ---------------------------------------------------------------------------

/**
 * Fetches the GoogleIntegration record for a user.
 * Throws if no integration exists.
 */
export async function getGoogleIntegration(userId: string): Promise<GoogleIntegration> {
  const integration = await prisma.googleIntegration.findUnique({
    where: { userId },
  });

  if (!integration) {
    throw new Error(`No Google integration found for user ${userId}`);
  }

  return integration;
}

// ---------------------------------------------------------------------------
// isServiceAccountConfigured
// ---------------------------------------------------------------------------

/**
 * Returns true if a global service account is available via environment
 * variables (either base64-encoded JSON or a file path).
 */
export function isServiceAccountConfigured(): boolean {
  return !!(env.GOOGLE_SERVICE_ACCOUNT_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH);
}

// ---------------------------------------------------------------------------
// getGoogleAuth  (main entry point)
// ---------------------------------------------------------------------------

/**
 * Returns an authenticated Google API client for the given user.
 *
 * - **OAuth mode**: Creates an `OAuth2Client` seeded with the user's
 *   encrypted access/refresh tokens. Sets up automatic token refresh that
 *   persists new tokens back to the database.
 * - **Service account mode**: Creates a `GoogleAuth` JWT client configured
 *   with domain-wide delegation, impersonating the user's delegated email.
 *
 * The returned `auth` can be passed directly to any `googleapis` service
 * constructor (e.g. `google.gmail({ version: 'v1', auth })`).
 */
export async function getGoogleAuth(userId: string): Promise<GoogleAuthResult> {
  const integration = await getGoogleIntegration(userId);

  if (integration.authMode === 'service_account') {
    log.debug({ userId }, 'Building service-account auth client');
    const auth = await buildServiceAccountClient(integration);
    return { auth, integration };
  }

  // Default: OAuth mode
  log.debug({ userId }, 'Building OAuth auth client');
  const auth = await buildOAuthClient(integration);
  return { auth, integration };
}

// ---------------------------------------------------------------------------
// refreshOAuthToken
// ---------------------------------------------------------------------------

/**
 * Forces a token refresh for an OAuth-mode integration.
 * Decrypts the stored refresh token, requests a new access token from Google,
 * and persists the updated (encrypted) tokens back to the database.
 *
 * Returns the updated integration record.
 */
export async function refreshOAuthToken(integration: GoogleIntegration): Promise<GoogleIntegration> {
  if (!integration.refreshToken) {
    throw new Error(`No refresh token stored for integration ${integration.id}`);
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for OAuth token refresh');
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret);
  const refreshToken = decryptPassword(integration.refreshToken);

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  log.info({ integrationId: integration.id, userId: integration.userId }, 'Refreshing OAuth access token');

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    const encryptedAccessToken = credentials.access_token
      ? encryptPassword(credentials.access_token)
      : null;

    // Google may rotate the refresh token; if a new one is returned, store it.
    const encryptedRefreshToken = credentials.refresh_token
      ? encryptPassword(credentials.refresh_token)
      : integration.refreshToken;

    const tokenExpiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null;

    const updated = await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        lastError: null,
        lastErrorAt: null,
      },
    });

    log.info(
      { integrationId: integration.id, expiresAt: tokenExpiresAt?.toISOString() },
      'OAuth access token refreshed successfully',
    );

    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ integrationId: integration.id, error: message }, 'Failed to refresh OAuth token');

    // Persist the error for visibility in the UI
    await prisma.googleIntegration.update({
      where: { id: integration.id },
      data: {
        lastError: `Token refresh failed: ${message}`,
        lastErrorAt: new Date(),
      },
    }).catch((dbErr) => {
      log.error({ integrationId: integration.id, error: dbErr }, 'Failed to persist token refresh error');
    });

    throw new Error(`Failed to refresh Google OAuth token: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds an OAuth2Client for the given integration, seeding it with the
 * user's decrypted tokens. If the access token is expired (or about to
 * expire), it is refreshed before returning.
 *
 * A `tokens` event listener is attached so that any token refresh triggered
 * by the Google client library itself is also persisted to the database.
 */
async function buildOAuthClient(integration: GoogleIntegration): Promise<OAuth2Client> {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for OAuth mode');
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret);

  // Seed existing credentials
  const credentials: Record<string, unknown> = {};

  if (integration.accessToken) {
    credentials.access_token = decryptPassword(integration.accessToken);
  }
  if (integration.refreshToken) {
    credentials.refresh_token = decryptPassword(integration.refreshToken);
  }
  if (integration.tokenExpiresAt) {
    credentials.expiry_date = integration.tokenExpiresAt.getTime();
  }

  oauth2Client.setCredentials(credentials);

  // Listen for automatic token refreshes from the Google client library
  // so we always persist the latest tokens.
  oauth2Client.on('tokens', (tokens) => {
    log.debug({ integrationId: integration.id }, 'Google client emitted new tokens');

    const data: Record<string, unknown> = {};

    if (tokens.access_token) {
      data.accessToken = encryptPassword(tokens.access_token);
    }
    if (tokens.refresh_token) {
      data.refreshToken = encryptPassword(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      data.tokenExpiresAt = new Date(tokens.expiry_date);
    }

    if (Object.keys(data).length > 0) {
      data.lastError = null;
      data.lastErrorAt = null;

      prisma.googleIntegration
        .update({ where: { id: integration.id }, data })
        .then(() => {
          log.debug({ integrationId: integration.id }, 'Persisted refreshed tokens to DB');
        })
        .catch((err) => {
          log.error({ integrationId: integration.id, error: err }, 'Failed to persist refreshed tokens');
        });
    }
  });

  // Proactively refresh if the token is expired or about to expire
  if (isTokenExpired(integration)) {
    log.info({ integrationId: integration.id }, 'Access token expired or near expiry, refreshing');
    const updated = await refreshOAuthToken(integration);

    // Re-seed the client with fresh credentials
    const freshCredentials: Record<string, unknown> = {};
    if (updated.accessToken) {
      freshCredentials.access_token = decryptPassword(updated.accessToken);
    }
    if (updated.refreshToken) {
      freshCredentials.refresh_token = decryptPassword(updated.refreshToken);
    }
    if (updated.tokenExpiresAt) {
      freshCredentials.expiry_date = updated.tokenExpiresAt.getTime();
    }
    oauth2Client.setCredentials(freshCredentials);
  }

  return oauth2Client;
}

/**
 * Builds a service-account JWT client with domain-wide delegation.
 *
 * Key resolution order:
 * 1. Per-integration encrypted key stored in the database
 * 2. Global `GOOGLE_SERVICE_ACCOUNT_KEY` env var (base64-encoded JSON)
 * 3. Global `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` env var (file path)
 */
async function buildServiceAccountClient(integration: GoogleIntegration): Promise<OAuth2Client> {
  const keyJson = resolveServiceAccountKey(integration);
  const delegatedEmail = integration.delegatedEmail || env.GOOGLE_DELEGATED_USER_EMAIL;

  if (!delegatedEmail) {
    throw new Error(
      `No delegated email configured for service-account integration ${integration.id}. ` +
      'Set delegatedEmail on the integration or GOOGLE_DELEGATED_USER_EMAIL in the environment.',
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: SCOPES,
    clientOptions: {
      subject: delegatedEmail,
    },
  });

  // getClient() returns a JWT or Compute client; for domain-wide delegation
  // it will be a JWT client which is compatible with OAuth2Client interface.
  const client = await auth.getClient();

  log.info(
    { integrationId: integration.id, delegatedEmail },
    'Service account auth client created',
  );

  return client as OAuth2Client;
}

/**
 * Resolves the service account key JSON from the integration record or
 * environment variables. Returns the parsed key object.
 */
function resolveServiceAccountKey(integration: GoogleIntegration): Record<string, unknown> {
  // 1. Per-integration key stored in DB (encrypted)
  if (integration.serviceAccountKey) {
    try {
      const decrypted = decryptPassword(integration.serviceAccountKey);
      return JSON.parse(decrypted) as Record<string, unknown>;
    } catch (error) {
      log.error(
        { integrationId: integration.id, error },
        'Failed to decrypt/parse per-integration service account key',
      );
      throw new Error('Invalid service account key stored on integration record');
    }
  }

  // 2. Global base64-encoded key from env
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const decoded = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf-8');
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch (error) {
      log.error({ error }, 'Failed to decode GOOGLE_SERVICE_ACCOUNT_KEY env var');
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY environment variable (expected base64-encoded JSON)');
    }
  }

  // 3. Key file path from env
  if (env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    try {
      const raw = fs.readFileSync(env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, 'utf-8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (error) {
      log.error(
        { path: env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH, error },
        'Failed to read service account key file',
      );
      throw new Error(
        `Failed to read service account key from ${env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH}`,
      );
    }
  }

  throw new Error(
    'No service account key available. Provide one on the integration record, ' +
    'or set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_PATH.',
  );
}

/**
 * Returns true if the integration's access token is expired or will expire
 * within the buffer window.
 */
function isTokenExpired(integration: GoogleIntegration): boolean {
  if (!integration.tokenExpiresAt) {
    // No expiry info -- assume expired to be safe
    return true;
  }

  return integration.tokenExpiresAt.getTime() - Date.now() < TOKEN_EXPIRY_BUFFER_MS;
}
