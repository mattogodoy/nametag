import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import GroupForm from '@/components/GroupForm';
import Navigation from '@/components/Navigation';
import { getTranslations } from 'next-intl/server';

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('groups');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: {
      id,
      userId: session.user.id,
      deletedAt: null,
    },
  });

  if (!group) {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { nameOrder: true },
  });
  const nameOrder = user?.nameOrder || 'WESTERN';

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/groups"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href={`/groups/${group.id}`}
              className="text-primary hover:underline text-sm"
            >
              {t('backToGroup', { name: group.name })}
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-6">
            {t('editGroupName', { name: group.name })}
          </h1>

          <div className="bg-surface shadow rounded-lg p-6">
            <GroupForm
              group={group}
              mode="edit"
              nameOrder={nameOrder}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
