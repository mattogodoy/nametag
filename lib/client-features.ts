interface OidcProviderInfo {
  enabled: boolean;
  name: string;
}

interface AvailableProviders {
  google: boolean;
  credentials: boolean;
  oidc: OidcProviderInfo;
}

let cachedProviders: AvailableProviders | null = null;

export async function fetchAvailableProviders(): Promise<AvailableProviders> {
  if (cachedProviders) {
    return cachedProviders;
  }

  try {
    const response = await fetch('/api/auth/available-providers');
    const data = await response.json();
    cachedProviders = data.providers;
    return cachedProviders!;
  } catch (error) {
    console.error('Failed to fetch available providers:', error);
    return { google: false, credentials: true, oidc: { enabled: false, name: 'SSO' } };
  }
}
