import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import PersonForm from '@/components/PersonForm';
import Navigation from '@/components/Navigation';

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [person, groups, relationshipTypes] = await Promise.all([
    prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        groups: true,
      },
    }),
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

  if (!person) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/people"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href={`/people/${person.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to {person.fullName}
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Edit {person.fullName}
          </h1>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <PersonForm person={person} groups={groups} relationshipTypes={relationshipTypes} mode="edit" />
          </div>
        </div>
      </main>
    </div>
  );
}
