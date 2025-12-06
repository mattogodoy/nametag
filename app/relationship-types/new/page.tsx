import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelationshipTypeForm from '@/components/RelationshipTypeForm';
import Navigation from '@/components/Navigation';

export default async function NewRelationshipTypePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get all available types for inverse relationship selection
  const availableTypes = await prisma.relationshipType.findMany({
    where: {
      OR: [
        { userId: null },
        { userId: session.user.id },
      ],
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
  });

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/relationship-types"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/relationship-types"
              className="link link-primary text-sm flex items-center gap-1"
            >
              <span className="icon-[tabler--arrow-left] size-4" />
              Back to Relationship Types
            </Link>
          </div>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h1 className="card-title text-2xl mb-4">
                Create Custom Relationship Type
              </h1>
              <RelationshipTypeForm availableTypes={availableTypes} mode="create" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
