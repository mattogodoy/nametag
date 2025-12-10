// Load .env file in development (optional in production where env vars come from Docker)
try {
  require('dotenv/config');
} catch {
  // dotenv not available or not needed (production)
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
