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
    <div className="min-h-screen bg-base-200">
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
              className="link link-primary text-sm flex items-center gap-1"
            >
              <span className="icon-[tabler--arrow-left] size-4" />
              Back to {group.name}
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6">
            Edit {group.name}
          </h1>

          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <GroupForm group={group} mode="edit" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
