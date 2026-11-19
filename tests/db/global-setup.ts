import { execSync } from 'node:child_process';

export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL is required for npm run test:db');
  }
  const parsed = new URL(url);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
  if (!/[_-]test$/i.test(dbName)) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends in "_test" or "-test"');
  }
  if (!localHosts.includes(parsed.hostname)) {
    throw new Error('TEST_DATABASE_URL must point at localhost, 127.0.0.1 or ::1');
  }
  process.env.DATABASE_URL = url;
  // Builds the schema from migrations only, so triggers missing from a
  // migration fail the suite.
  execSync('npx prisma migrate reset --force', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
