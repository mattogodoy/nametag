/**
 * Client-side feature flags
 * Fetches available providers from the server
 */

import type { AvailableAuthProviderMap } from '@/lib/auth-providers';
import {
  AUTH_PROVIDER,
  AUTH_PROVIDER_IDS,
  OAUTH_PROVIDER_IDS,
} from '@/lib/auth-provider-constants';
import type {
  AuthProviderId,
  OAuthProviderId,
} from '@/lib/auth-provider-constants';

export interface AvailableProviders extends AvailableAuthProviderMap {
  isOnlyOneSsoProviderEnabled: boolean;
  onlyEnabledSsoProvider: OAuthProviderId | null;
}

export async function fetchAvailableProviders(): Promise<AvailableProviders> {
  try {
    const response = await fetch('/api/auth/available-providers', {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch providers: ${response.status}`);
    }

    const data = await response.json();
    const providers = {} as AvailableAuthProviderMap;

    for (const provider of AUTH_PROVIDER_IDS) {
      const providerData = data?.[provider];
      let displayName = providerData?.display_name || null;

      if (provider === AUTH_PROVIDER.OIDC && !displayName) {
        displayName = 'OIDC';
      }

      providers[provider] = {
        enabled: !!providerData?.enabled,
        display_name: displayName,
        icon_url: providerData?.icon_url || null,
      };
    }

    const enabledSsoProviders = OAUTH_PROVIDER_IDS.filter(
      (provider) => providers[provider].enabled,
    );

    return {
      ...providers,
      isOnlyOneSsoProviderEnabled: enabledSsoProviders.length === 1,
      onlyEnabledSsoProvider:
        enabledSsoProviders.length === 1 ? enabledSsoProviders[0] : null,
    };
  } catch (error) {
    console.error('Failed to fetch available providers:', error);
    const fallbackEnabled: Record<AuthProviderId, boolean> = {
      [AUTH_PROVIDER.CREDENTIALS]: true,
      [AUTH_PROVIDER.GOOGLE]: false,
      [AUTH_PROVIDER.OIDC]: false,
    };
    const fallbackProviders = {} as AvailableAuthProviderMap;

    for (const provider of AUTH_PROVIDER_IDS) {
      fallbackProviders[provider] = {
        enabled: fallbackEnabled[provider],
        display_name: provider === AUTH_PROVIDER.OIDC ? 'OIDC Provider' : null,
        icon_url: null,
      };
    }

    return {
      ...fallbackProviders,
      isOnlyOneSsoProviderEnabled: false,
      onlyEnabledSsoProvider: null,
    };
  }
}
