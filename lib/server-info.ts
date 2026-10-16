import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { isFeatureEnabled, isSaasMode } from '@/lib/features';
import { isPushConfigured } from '@/lib/notifications/vapid';
import { getVersion } from '@/lib/version';

/**
 * Version of the API contract native clients depend on. Bump only for a
 * breaking change to an endpoint they use. Adding fields is not breaking.
 */
export const API_VERSION = 1;

export interface LoginProviders {
  credentials: boolean;
  google: boolean;
  oidc: { enabled: boolean; name: string };
}

export type RegistrationDisabledReason = 'passwordLoginDisabled' | 'registrationDisabled';

export type RegistrationStatus =
  | { enabled: true }
  | { enabled: false; reason: RegistrationDisabledReason };

export interface ServerInfo {
  name: 'Nametag';
  version: string;
  apiVersion: number;
  mode: 'saas' | 'selfhosted';
  auth: {
    password: boolean;
    google: boolean;
    oidc: { enabled: boolean; name: string };
    emailVerificationRequired: boolean;
    registration: RegistrationStatus;
  };
  features: {
    billing: boolean;
    cardDav: boolean;
    webPush: boolean;
  };
}

export function getLoginProviders(): LoginProviders {
  return {
    credentials: isFeatureEnabled('passwordLogin'),
    google: isSaasMode() && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
    oidc: {
      enabled: isFeatureEnabled('oidc'),
      name: env.OIDC_DISPLAY_NAME || 'SSO',
    },
  };
}

export async function getRegistrationStatus(): Promise<RegistrationStatus> {
  // Password registration is not available when password login is disabled
  if (!isFeatureEnabled('passwordLogin')) {
    return { enabled: false, reason: 'passwordLoginDisabled' };
  }

  if (process.env.DISABLE_REGISTRATION !== 'true') {
    return { enabled: true };
  }

  // The first user can still register so a fresh install is never locked out
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    return { enabled: true };
  }

  return { enabled: false, reason: 'registrationDisabled' };
}

export async function getServerInfo(): Promise<ServerInfo> {
  const providers = getLoginProviders();

  return {
    name: 'Nametag',
    version: getVersion(),
    apiVersion: API_VERSION,
    mode: isSaasMode() ? 'saas' : 'selfhosted',
    auth: {
      password: providers.credentials,
      google: providers.google,
      oidc: providers.oidc,
      emailVerificationRequired: isFeatureEnabled('emailVerification'),
      registration: await getRegistrationStatus(),
    },
    features: {
      billing: isFeatureEnabled('billing'),
      cardDav: isFeatureEnabled('cardDav'),
      webPush: isPushConfigured(),
    },
  };
}
