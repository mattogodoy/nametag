export const AUTH_PROVIDER = {
  CREDENTIALS: 'credentials',
  GOOGLE: 'google',
  OIDC: 'oidc',
} as const;

export type AuthProviderId = (typeof AUTH_PROVIDER)[keyof typeof AUTH_PROVIDER];

export type OAuthProviderId = Exclude<
  AuthProviderId,
  typeof AUTH_PROVIDER.CREDENTIALS
>;

export const AUTH_PROVIDER_IDS = Object.values(
  AUTH_PROVIDER,
) as AuthProviderId[];

export const OAUTH_PROVIDER_IDS = AUTH_PROVIDER_IDS.filter(
  (provider): provider is OAuthProviderId =>
    provider !== AUTH_PROVIDER.CREDENTIALS,
);
