import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
    },
    take: 5,
  });
  
  console.log('Users in database:');
  console.log(JSON.stringify(users, null, 2));
  
  const count = await prisma.user.count();
  console.log(`\nTotal users: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
