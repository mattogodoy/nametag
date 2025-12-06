import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '.next/',
        'prisma/',
      ],
    },
    // Mock environment variables for tests
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NEXTAUTH_URL: 'http://localhost:3000',
      NEXTAUTH_SECRET: 'test-secret-key-that-is-at-least-32-chars',
      RESEND_API_KEY: 'test-resend-api-key',
      EMAIL_DOMAIN: 'test.example.com',
      CRON_SECRET: 'test-cron-secret-16-chars',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
