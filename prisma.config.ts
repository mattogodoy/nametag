// Load .env file in development (optional in production where env vars come from Docker)
await (async () => {
  try {
    await import('dotenv/config');
  } catch {
    // dotenv not available or not needed (production)
  }
})();

// Construct DATABASE_URL from individual DB_* variables if not set
if (!process.env.DATABASE_URL) {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
    const password = DB_PASSWORD ? `:${DB_PASSWORD}` : '';
    process.env.DATABASE_URL = `postgresql://${DB_USER}${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
}

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
