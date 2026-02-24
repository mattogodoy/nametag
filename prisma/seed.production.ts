import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Construct DATABASE_URL from individual DB_* variables if not set
if (!process.env.DATABASE_URL) {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST && DB_PORT && DB_NAME && DB_USER) {
    const password = DB_PASSWORD ? `:${DB_PASSWORD}` : '';
    process.env.DATABASE_URL = `postgresql://${DB_USER}${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
  }
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// Default relationship types configuration
const DEFAULT_RELATIONSHIP_TYPES = [
  { name: 'PARENT', label: 'Parent', color: '#F59E0B', inverseName: 'CHILD' },
  { name: 'CHILD', label: 'Child', color: '#F59E0B', inverseName: 'PARENT' },
  { name: 'SIBLING', label: 'Sibling', color: '#8B5CF6', inverseName: 'SIBLING' },
  { name: 'SPOUSE', label: 'Spouse', color: '#EC4899', inverseName: 'SPOUSE' },
  { name: 'PARTNER', label: 'Partner', color: '#EC4899', inverseName: 'PARTNER' },
  { name: 'FRIEND', label: 'Friend', color: '#3B82F6', inverseName: 'FRIEND' },
  { name: 'COLLEAGUE', label: 'Colleague', color: '#10B981', inverseName: 'COLLEAGUE' },
  { name: 'ACQUAINTANCE', label: 'Acquaintance', color: '#14B8A6', inverseName: 'ACQUAINTANCE' },
  { name: 'RELATIVE', label: 'Relative', color: '#6366F1', inverseName: 'RELATIVE' },
  { name: 'OTHER', label: 'Other', color: '#6B7280', inverseName: 'OTHER' },
];

async function createDefaultRelationshipTypes(userId: string, userEmail: string) {
  console.log(`  Creating relationship types for user: ${userEmail}`);

  // Create all relationship types first
  const createdTypes = new Map<string, string>(); // name -> id

  for (const type of DEFAULT_RELATIONSHIP_TYPES) {
    const created = await prisma.relationshipType.create({
      data: {
        userId,
        name: type.name,
        label: type.label,
        color: type.color,
      },
    });
    createdTypes.set(type.name, created.id);
  }

  // Set inverse relationships
  for (const type of DEFAULT_RELATIONSHIP_TYPES) {
    const typeId = createdTypes.get(type.name);
    const inverseId = createdTypes.get(type.inverseName);

    if (typeId && inverseId) {
      await prisma.relationshipType.update({
        where: { id: typeId },
        data: { inverseId },
      });
    }
  }

  console.log(`  ✓ Created ${DEFAULT_RELATIONSHIP_TYPES.length} relationship types`);
}

async function main() {
  console.log('🌱 Starting production seed - relationship types...\n');

  // Find all users
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      relationshipTypes: {
        select: { id: true },
      },
    },
  });

  if (users.length === 0) {
    console.log('ℹ️  No users found in database. Relationship types will be created when users register.');
    return;
  }

  console.log(`Found ${users.length} user(s) in database\n`);

  let processedCount = 0;
  let skippedCount = 0;

  // Process each user
  for (const user of users) {
    if (user.relationshipTypes.length > 0) {
      console.log(`  Skipping user ${user.email} - already has ${user.relationshipTypes.length} relationship types`);
      skippedCount++;
      continue;
    }

    await createDefaultRelationshipTypes(user.id, user.email);
    processedCount++;
  }

  console.log('\n🎉 Production seed completed!');
  console.log(`   Users processed: ${processedCount}`);
  console.log(`   Users skipped: ${skippedCount}`);

  if (processedCount > 0) {
    console.log(`\n✅ Created default relationship types for ${processedCount} user(s)`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
