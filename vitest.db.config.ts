import { defineConfig } from 'vitest/config';
import path from 'path';

// Tests that need a real PostgreSQL database (triggers, locking).
// Run with: TEST_DATABASE_URL=postgresql://... npm run test:db
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.db.test.ts'],
    globalSetup: ['./tests/db/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    env: {
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret-key-that-is-at-least-32-chars',
      RESEND_API_KEY: 'test-resend-api-key',
      EMAIL_DOMAIN: 'test.example.com',
      CRON_SECRET: 'test-cron-secret-16-chars',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
});
