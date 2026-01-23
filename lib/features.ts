import { env } from './env';

/**
 * Check if the application is running in SaaS mode.
 *
 * SaaS mode enables:
 * - Billing UI and payment processing
 * - Tier-based resource limits
 * - Usage tracking and meters
 * - Email verification for new accounts
 *
 * When disabled (default), the application runs in "self-hosted" mode
 * with unlimited resources, no billing, and no email verification required.
 */
export function isSaasMode(): boolean {
  return env.SAAS_MODE === true;
}

/**
 * Feature flags for SaaS vs Self-Hosted mode.
 *
 * Easily extensible for future SaaS-only features.
 */
export const features = {
  /** Show billing UI (settings nav, billing page, upgrade prompts) */
  billing: () => isSaasMode(),

  /** Enforce tier-based resource limits */
  tierLimits: () => isSaasMode(),

  /** Show usage meters and limit warnings */
  usageTracking: () => isSaasMode(),

  /** Show upgrade CTAs and pricing */
  upgradeCtas: () => isSaasMode(),

  /** Require email verification for new accounts */
  emailVerification: () => isSaasMode(),

  /** Enable Google OAuth provider */
  googleOAuth: () => isSaasMode(),

  /** Require Redis (fail if not configured) */
  requireRedis: () => isSaasMode(),

  /** Enable CardDAV sync integration */
  cardDav: () => true, // Available in all modes
};

/**
 * Check if a specific feature is enabled.
 *
 * @example
 * if (isFeatureEnabled('billing')) {
 *   // Show billing section
 * }
 */
export function isFeatureEnabled(feature: keyof typeof features): boolean {
  return features[feature]();
}
