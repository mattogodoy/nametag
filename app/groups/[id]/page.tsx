import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeleteGroupButton from '@/components/DeleteGroupButton';
import Navigation from '@/components/Navigation';
import GroupMembersManager from '@/components/GroupMembersManager';
import { formatFullName } from '@/lib/nameUtils';

export default async function GroupDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [group, allPeople] = await Promise.all([
    prisma.group.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        people: {
          include: {
            person: {
              select: {
                id: true,
                name: true,
                surname: true,
                nickname: true,
              },
            },
          },
        },
      },
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ]);

  if (!group) {
    notFound();
  }

  const currentMembers = group.people.map((pg) => pg.person);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/groups"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to Groups
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-visible">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-center flex-1 min-w-0">
                {group.color && (
                  <div
                    className="w-12 h-12 rounded-full mr-4 flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">
                    {group.name}
                  </h1>
                  {group.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 space-x-3 w-full sm:w-auto">
                <Link
                  href={`/groups/${group.id}/edit`}
                  className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
                >
                  Edit
                </Link>
                <DeleteGroupButton groupId={group.id} groupName={group.name} />
              </div>
            </div>

            <div className="px-6 py-5">
              <GroupMembersManager
                groupId={group.id}
                groupName={group.name}
                currentMembers={currentMembers}
                availablePeople={allPeople}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
