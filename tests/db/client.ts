import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required');
process.env.DATABASE_URL = url;

export const testPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

let counter = 0;

export async function createUser(email?: string): Promise<{ id: string }> {
  counter += 1;
  return testPrisma.user.create({
    data: { email: email ?? `user${Date.now()}-${counter}@test.example.com`, name: 'Test' },
    select: { id: true },
  });
}

/** Deletes every user; cascades remove their data. */
export async function resetDb(): Promise<void> {
  await testPrisma.user.deleteMany({});
}
