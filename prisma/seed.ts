import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.relationship.deleteMany();
  await prisma.relationshipType.deleteMany();
  await prisma.personGroup.deleteMany();
  await prisma.person.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@nametag.one',
      password: hashedPassword,
      name: 'Demo User',
      theme: 'LIGHT',
    },
  });

  console.log('✓ Created demo user: demo@nametag.one');

  // Create relationship types for the demo user
  const parentType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'PARENT',
      label: 'Parent',
      color: '#F59E0B',
    },
  });

  const childType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'CHILD',
      label: 'Child',
      color: '#F59E0B',
    },
  });

  const siblingType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'SIBLING',
      label: 'Sibling',
      color: '#8B5CF6',
    },
  });

  const spouseType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'SPOUSE',
      label: 'Spouse',
      color: '#EC4899',
    },
  });

  const partnerType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'PARTNER',
      label: 'Partner',
      color: '#EC4899',
    },
  });

  const friendType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'FRIEND',
      label: 'Friend',
      color: '#3B82F6',
    },
  });

  const colleagueType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'COLLEAGUE',
      label: 'Colleague',
      color: '#10B981',
    },
  });

  const _acquaintanceType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'ACQUAINTANCE',
      label: 'Acquaintance',
      color: '#14B8A6',
    },
  });

  const relativeType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'RELATIVE',
      label: 'Relative',
      color: '#6366F1',
    },
  });

  const _otherType = await prisma.relationshipType.create({
    data: {
      userId: user.id,
      name: 'OTHER',
      label: 'Other',
      color: '#6B7280',
    },
  });

  // Set inverse relationships
  await prisma.relationshipType.update({
    where: { id: parentType.id },
    data: { inverseId: childType.id },
  });

  await prisma.relationshipType.update({
    where: { id: childType.id },
    data: { inverseId: parentType.id },
  });

  await prisma.relationshipType.update({
    where: { id: siblingType.id },
    data: { inverseId: siblingType.id },
  });

  await prisma.relationshipType.update({
    where: { id: spouseType.id },
    data: { inverseId: spouseType.id },
  });

  await prisma.relationshipType.update({
    where: { id: partnerType.id },
    data: { inverseId: partnerType.id },
  });

  await prisma.relationshipType.update({
    where: { id: friendType.id },
    data: { inverseId: friendType.id },
  });

  console.log('✓ Created 10 relationship types for demo user');

  // Create groups
  const familyGroup = await prisma.group.create({
    data: {
      userId: user.id,
      name: 'Family',
      description: 'Family members',
      color: '#EF4444',
    },
  });

  const friendsGroup = await prisma.group.create({
    data: {
      userId: user.id,
      name: 'Friends',
      description: 'Close friends',
      color: '#3B82F6',
    },
  });

  const workGroup = await prisma.group.create({
    data: {
      userId: user.id,
      name: 'Work',
      description: 'Colleagues and professional contacts',
      color: '#10B981',
    },
  });

  console.log('✓ Created 3 groups');

  // Create people
  const john = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'John',
      surname: 'Smith',
      lastContact: new Date('2024-11-25'),
      notes: 'My brother. Works as a software engineer. Phone: +1 (555) 123-4567. Address: 123 Main St, Springfield, IL',
      relationshipToUserId: siblingType.id,
      groups: {
        create: [{ groupId: familyGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('1985-03-15') }],
      },
    },
  });

  const sarah = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'Sarah',
      surname: 'Johnson',
      lastContact: new Date('2024-11-20'),
      notes: "John's wife. Teacher at elementary school. Phone: +1 (555) 234-5678. Address: 123 Main St, Springfield, IL",
      relationshipToUserId: relativeType.id,
      groups: {
        create: [{ groupId: familyGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('1987-07-22') }],
      },
    },
  });

  const emma = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'Emma',
      surname: 'Smith',
      notes: "John and Sarah's daughter. Loves reading and drawing.",
      relationshipToUserId: relativeType.id,
      groups: {
        create: [{ groupId: familyGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('2015-05-10') }],
      },
    },
  });

  const lucas = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'Lucas',
      surname: 'Smith',
      notes: "John and Sarah's son. Plays soccer.",
      relationshipToUserId: relativeType.id,
      groups: {
        create: [{ groupId: familyGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('2018-09-03') }],
      },
    },
  });

  const mike = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'Mike',
      surname: 'Chen',
      lastContact: new Date('2024-11-28'),
      notes: 'Best friend from college. Software developer at TechCorp. Phone: +1 (555) 345-6789',
      relationshipToUserId: friendType.id,
      groups: {
        create: [{ groupId: friendsGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('1990-01-18') }],
      },
    },
  });

  const jessica = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'Jessica',
      surname: 'Martinez',
      lastContact: new Date('2024-11-15'),
      notes: 'Colleague from work. Project manager. Email: jessica@example.com. Phone: +1 (555) 456-7890',
      relationshipToUserId: colleagueType.id,
      groups: {
        create: [{ groupId: workGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('1988-11-30') }],
      },
    },
  });

  const david = await prisma.person.create({
    data: {
      userId: user.id,
      name: 'David',
      surname: 'Brown',
      lastContact: new Date('2024-10-20'),
      notes: 'Neighbor and friend. Architect. Phone: +1 (555) 567-8901',
      relationshipToUserId: friendType.id,
      groups: {
        create: [{ groupId: friendsGroup.id }],
      },
      importantDates: {
        create: [{ title: 'Birthday', date: new Date('1983-06-12') }],
      },
    },
  });

  console.log('✓ Created 7 people');

  // Create relationships
  await prisma.relationship.createMany({
    data: [
      // John's relationships
      {
        personId: john.id,
        relatedPersonId: sarah.id,
        relationshipTypeId: spouseType.id,
        notes: 'Married since 2010',
      },
      {
        personId: john.id,
        relatedPersonId: emma.id,
        relationshipTypeId: parentType.id,
      },
      {
        personId: john.id,
        relatedPersonId: lucas.id,
        relationshipTypeId: parentType.id,
      },
      {
        personId: john.id,
        relatedPersonId: mike.id,
        relationshipTypeId: friendType.id,
      },

      // Sarah's relationships
      {
        personId: sarah.id,
        relatedPersonId: john.id,
        relationshipTypeId: spouseType.id,
        notes: 'Married since 2010',
      },
      {
        personId: sarah.id,
        relatedPersonId: emma.id,
        relationshipTypeId: parentType.id,
      },
      {
        personId: sarah.id,
        relatedPersonId: lucas.id,
        relationshipTypeId: parentType.id,
      },

      // Emma's relationships
      {
        personId: emma.id,
        relatedPersonId: john.id,
        relationshipTypeId: childType.id,
      },
      {
        personId: emma.id,
        relatedPersonId: sarah.id,
        relationshipTypeId: childType.id,
      },
      {
        personId: emma.id,
        relatedPersonId: lucas.id,
        relationshipTypeId: siblingType.id,
      },

      // Lucas's relationships
      {
        personId: lucas.id,
        relatedPersonId: john.id,
        relationshipTypeId: childType.id,
      },
      {
        personId: lucas.id,
        relatedPersonId: sarah.id,
        relationshipTypeId: childType.id,
      },
      {
        personId: lucas.id,
        relatedPersonId: emma.id,
        relationshipTypeId: siblingType.id,
      },

      // Mike's relationships
      {
        personId: mike.id,
        relatedPersonId: john.id,
        relationshipTypeId: friendType.id,
      },

      // Jessica's relationships
      {
        personId: jessica.id,
        relatedPersonId: mike.id,
        relationshipTypeId: colleagueType.id,
      },

      // David's relationships
      {
        personId: david.id,
        relatedPersonId: john.id,
        relationshipTypeId: friendType.id,
      },
    ],
  });

  console.log('✓ Created relationships');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nDemo credentials:');
  console.log('Email: demo@nametag.one');
  console.log('Password: password123');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
