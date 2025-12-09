import { z } from 'zod';

/**
 * Environment variable validation
 * This ensures all required environment variables are present at startup
 */

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // NextAuth
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_DOMAIN: z.string().min(1, 'EMAIL_DOMAIN is required'),

  // Cron
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),

  // Redis (Optional for development, recommended for production)
  REDIS_URL: z.string().url().optional(),

  // Optional
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Error Tracking (Optional)
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed env object
 * Throws an error with details if validation fails
 */
function validateEnv(): Env {
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
