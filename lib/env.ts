import { z } from 'zod';

/**
 * Environment variable validation
 * This ensures all required environment variables are present at startup
 */

const envSchema = z.object({
  // Database - either DATABASE_URL or individual DB_* variables
  DATABASE_URL: z.string().min(1).optional(),
  DB_HOST: z.string().min(1).optional(),
  DB_PORT: z.coerce.number().min(1).max(65535).optional(),
  DB_NAME: z.string().min(1).optional(),
  DB_USER: z.string().min(1).optional(),
  DB_PASSWORD: z.string().optional(), // Optional to allow empty passwords

  // NextAuth
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Email (Resend) - Only required in SaaS mode
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required').optional(),
  EMAIL_DOMAIN: z.string().min(1, 'EMAIL_DOMAIN is required').optional(),

  // Email (SMTP) - Optional alternative to Resend
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().min(1).max(65535).optional(),
  SMTP_SECURE: z.coerce.boolean().default(false).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_REQUIRE_TLS: z.coerce.boolean().default(true).optional(),
  SMTP_FROM: z.string().optional(), // Override from address (e.g., for servers that reject custom from addresses)

  // Google OAuth - Only required in SaaS mode
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Stripe - Only required in SaaS mode
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),

  // Cron
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  // Redis (Optional for development, recommended for production)
  REDIS_URL: z.string().url().optional(),

  // Optional
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // SaaS mode - enables billing and tier limits (undocumented, for internal use)
  SAAS_MODE: z.coerce.boolean().default(false),

  // Disable registration after first user (useful for public-facing self-hosted instances)
  DISABLE_REGISTRATION: z.coerce.boolean().default(false),

  // Application URL for generating links in emails (optional, defaults to NEXTAUTH_URL)
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

/**
 * Get the application URL for generating links.
 * Falls back to NEXTAUTH_URL if NEXT_PUBLIC_APP_URL is not set.
 * This allows users to set just NEXTAUTH_URL for most deployments.
 */
export function getAppUrl(): string {
  const env = getEnv();
  return env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL;
}

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed env object
 * Throws an error with details if validation fails
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );

    console.error('\n❌ Invalid environment variables:\n');
    console.error(errors.join('\n'));
    console.error('\nPlease check your .env file.\n');

    throw new Error('Invalid environment configuration');
  }

  // Database URL validation and construction
  if (!result.data.DATABASE_URL) {
    // If DATABASE_URL is not set, try to construct it from DB_* variables
    const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = result.data;
    const requiredDbVars = { DB_HOST, DB_PORT, DB_NAME, DB_USER };
    const missingVars = Object.entries(requiredDbVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error('\n❌ Invalid environment variables:\n');
      console.error('  - Database configuration is incomplete.');
      console.error('\n  You must provide either:');
      console.error('    1. DATABASE_URL (connection string), OR');
      console.error('    2. All of: DB_HOST, DB_PORT, DB_NAME, DB_USER (and optionally DB_PASSWORD)');
      console.error(`\n  Missing: ${missingVars.join(', ')}`);
      console.error('\nPlease check your .env file.\n');
      throw new Error('Invalid environment configuration');
    }

    // Construct DATABASE_URL from individual variables
    const password = DB_PASSWORD ? `:${DB_PASSWORD}` : '';
    result.data.DATABASE_URL = `postgresql://${DB_USER}${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }

  // Additional validation: Email and OAuth settings required in SaaS mode
  if (result.data.SAAS_MODE) {
    const missing = [];

    // Require either Resend OR SMTP for email
    const hasResend = !!result.data.RESEND_API_KEY;
    const hasSmtp = !!(result.data.SMTP_HOST && result.data.SMTP_PORT);
    if (!hasResend && !hasSmtp) {
      missing.push('RESEND_API_KEY or SMTP_HOST+SMTP_PORT');
    }

    if (!result.data.EMAIL_DOMAIN) missing.push('EMAIL_DOMAIN');
    if (!result.data.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
    if (!result.data.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
    if (!result.data.STRIPE_WEBHOOK_SECRET) missing.push('STRIPE_WEBHOOK_SECRET');

    if (missing.length > 0) {
      console.error('\n❌ Invalid environment variables:\n');
      console.error(`  - The following are required when SAAS_MODE is enabled: ${missing.join(', ')}`);
      console.error('\nPlease check your .env file.\n');
      throw new Error(`Invalid environment configuration: missing ${missing.join(', ')}`);
    }
  }

  // Validate SMTP configuration - if any SMTP var is set, host and port are required
  const smtpVars = [
    result.data.SMTP_HOST,
    result.data.SMTP_PORT,
    result.data.SMTP_USER,
    result.data.SMTP_PASS,
  ];
  const hasAnySmtpConfig = smtpVars.some(v => v !== undefined);

  if (hasAnySmtpConfig && (!result.data.SMTP_HOST || !result.data.SMTP_PORT)) {
    console.error('\n❌ Invalid environment variables:\n');
    console.error('  - If any SMTP_* variable is set, both SMTP_HOST and SMTP_PORT are required');
    console.error('\nPlease check your .env file.\n');
    throw new Error('Invalid environment configuration');
  }

  // Validate that EMAIL_DOMAIN is set if either email provider is configured
  const hasEmailProvider =
    (result.data.RESEND_API_KEY) ||
    (result.data.SMTP_HOST && result.data.SMTP_PORT);

  if (hasEmailProvider && !result.data.EMAIL_DOMAIN) {
    console.error('\n❌ Invalid environment variables:\n');
    console.error('  - EMAIL_DOMAIN is required when email is configured (Resend or SMTP)');
    console.error('\nPlease check your .env file.\n');
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

// Validate on module load in production
// In development, we validate lazily to allow hot reload
let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

// For convenience, export individual env vars with type safety
export const env = new Proxy({} as Env, {
  get(_, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
