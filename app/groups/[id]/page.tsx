import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeleteGroupButton from '@/components/DeleteGroupButton';
import Navigation from '@/components/Navigation';
import GroupMembersManager from '@/components/GroupMembersManager';

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
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/groups" className="link link-primary text-sm flex items-center gap-1">
              <span className="icon-[tabler--arrow-left] size-4" />
              Back to Groups
            </Link>
          </div>

          <div className="card bg-base-100 shadow-lg overflow-visible">
            <div className="card-body border-b border-base-content/10">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-center flex-1 min-w-0">
                  {group.color && (
                    <div
                      className="w-12 h-12 rounded-full mr-4 flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                  )}
                  <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold break-words">
                      {group.name}
                    </h1>
                    {group.description && (
                      <p className="text-base-content/60 mt-1">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-3 w-full sm:w-auto">
                  <Link
                    href={`/groups/${group.id}/edit`}
                    className="btn btn-primary flex-1 sm:flex-none"
                  >
                    <span className="icon-[tabler--edit] size-4" />
                    Edit
                  </Link>
                  <DeleteGroupButton groupId={group.id} groupName={group.name} />
                </div>
              </div>
            </div>

            <div className="card-body">
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
