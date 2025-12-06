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
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="card bg-base-100 shadow-xl max-w-md">
          <div className="card-body">
            <h1 className="card-title text-2xl">
              Cannot Edit Default Type
            </h1>
            <p className="text-base-content/70">
              Default relationship types cannot be modified. You can create custom types instead.
            </p>
            <div className="card-actions justify-end mt-4">
              <Link
                href="/relationship-types"
                className="btn btn-primary"
              >
                Back to Relationship Types
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
                Edit Relationship Type
              </h1>
              <RelationshipTypeForm
                relationshipType={relationshipType}
                availableTypes={availableTypes}
                mode="edit"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
