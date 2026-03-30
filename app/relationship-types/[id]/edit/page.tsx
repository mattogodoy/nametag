import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import RelationshipTypeForm from '@/components/RelationshipTypeForm';
import Navigation from '@/components/Navigation';
import { getTranslations } from 'next-intl/server';

export default async function EditRelationshipTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('relationshipTypes');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [relationshipType, availableTypes] = await Promise.all([
    prisma.relationshipType.findFirst({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
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
        userId: session.user.id,
        deletedAt: null,
        NOT: { id }, // Exclude current type from inverse options
      },
      select: {
        id: true,
        name: true,
        label: true,
        color: true,
        inverseId: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!relationshipType) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/relationship-types"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/relationship-types"
              className="text-primary hover:underline text-sm"
            >
              {t('backToTypes')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6">
              {t('editType')}
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
