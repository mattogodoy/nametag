import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelationshipTypeForm from '@/components/RelationshipTypeForm';
import Navigation from '@/components/Navigation';

export default async function EditRelationshipTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [relationshipType, availableTypes] = await Promise.all([
    prisma.relationshipType.findFirst({
      where: {
        id,
        userId: session.user.id, // Only allow editing user's own types
      },
      include: {
        inverse: {
          select: {
            id: true,
            name: true,
            label: true,
          },
        },
      },
    }),
    prisma.relationshipType.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: session.user.id },
        ],
        NOT: { id }, // Exclude current type from inverse options
      },
      select: {
        id: true,
        name: true,
        label: true,
        color: true,
        inverseId: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    }),
  ]);

  if (!relationshipType) {
    notFound();
  }

  if (relationshipType.isDefault) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Cannot Edit Default Type
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Default relationship types cannot be modified. You can create custom types instead.
          </p>
          <Link
            href="/relationship-types"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Back to Relationship Types
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/relationship-types"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/relationship-types"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to Relationship Types
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Edit Relationship Type
            </h1>
            <RelationshipTypeForm
              relationshipType={relationshipType}
              availableTypes={availableTypes}
              mode="edit"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
