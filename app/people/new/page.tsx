import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PersonForm from '@/components/PersonForm';
import Navigation from '@/components/Navigation';

export default async function NewPersonPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const [groups, relationshipTypes] = await Promise.all([
    prisma.group.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.relationshipType.findMany({
      where: {
        OR: [{ userId: session.user.id }, { isDefault: true }],
      },
      orderBy: {
        label: 'asc',
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/people"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Add New Person
          </h1>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <PersonForm groups={groups} relationshipTypes={relationshipTypes} mode="create" />
          </div>
        </div>
      </main>
    </div>
  );
}
