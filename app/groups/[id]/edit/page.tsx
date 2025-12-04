import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import GroupForm from '@/components/GroupForm';
import Navigation from '@/components/Navigation';

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!group) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href={`/groups/${group.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to {group.name}
            </Link>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Edit {group.name}
          </h1>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <GroupForm group={group} mode="edit" />
          </div>
        </div>
      </main>
    </div>
  );
}
