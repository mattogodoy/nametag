import { env } from '@/lib/env';
import { isSaasMode } from '@/lib/features';
import {
  AUTH_PROVIDER,
  AUTH_PROVIDER_IDS,
  OAUTH_PROVIDER_IDS,
} from '@/lib/auth-provider-constants';
import type {
  AuthProviderId,
  OAuthProviderId,
} from '@/lib/auth-provider-constants';

export { AUTH_PROVIDER };
export type { AuthProviderId, OAuthProviderId };

export type AvailableAuthProviderMap = Record<
  AuthProviderId,
  {
    enabled: boolean;
    display_name: string | null;
    icon_url: string | null;
  }
>;

export function isOAuthProvider(
  provider: string | null | undefined,
): provider is OAuthProviderId {
  return OAUTH_PROVIDER_IDS.includes(provider as OAuthProviderId);
}

export function isAuthProviderEnabled(provider: AuthProviderId): boolean {
  const saasMode = isSaasMode();

  switch (provider) {
    case AUTH_PROVIDER.GOOGLE:
      return Boolean(
        saasMode && !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
      );
    case AUTH_PROVIDER.OIDC:
      return Boolean(
        env.OIDC_ENABLED &&
        !!env.OIDC_ISSUER_URL &&
        !!env.OIDC_CLIENT_ID &&
        !!env.OIDC_CLIENT_SECRET,
      );
    case AUTH_PROVIDER.CREDENTIALS:
      return env.PASSWORD_LOGIN_ENABLED !== false;
    default:
      return false;
  }
}

export function getAvailableAuthProviders(): AvailableAuthProviderMap {
  const providers = {} as AvailableAuthProviderMap;

  for (const provider of AUTH_PROVIDER_IDS) {
    let displayName: string | null = null;
    let iconUrl: string | null = null;

    switch (provider) {
      case AUTH_PROVIDER.OIDC:
        displayName = env.OIDC_DISPLAY_NAME || 'OIDC Provider';
        iconUrl = env.OIDC_ICON_URL || null;
        break;
    }

    providers[provider] = {
      enabled: isAuthProviderEnabled(provider),
      display_name: displayName,
      icon_url: iconUrl,
    };
  }

  return providers;
}

// Returns the only enabled SSO provider (Google/OIDC), or null when
// none or multiple SSO providers are enabled.
export function isOnlyOneSSOProviderEnabled(): boolean {
  return getOnlyEnabledSSOProvider() !== null;
}

export function getOnlyEnabledSSOProvider(): OAuthProviderId | null {
  const providers = getAvailableAuthProviders();
  const enabledSsoProviders = OAUTH_PROVIDER_IDS.filter(
    (provider) => providers[provider].enabled,
  );

  return enabledSsoProviders.length === 1 ? enabledSsoProviders[0] : null;
}
