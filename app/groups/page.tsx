import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';

export default async function GroupsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const groups = await prisma.group.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      _count: {
        select: {
          people: true,
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/groups"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Groups
            </h1>
            <Link
              href="/groups/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Add Group
            </Link>
          </div>

          {groups.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <EmptyState
                icon="📁"
                title="No groups yet"
                description="Create groups to organize your network. Groups help you categorize people by family, friends, work, or any custom category."
                actionLabel="Create Your First Group"
                actionHref="/groups/new"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {group.description}
                        </p>
                      )}
                    </div>
                    {group.color && (
                      <div
                        className="w-6 h-6 rounded-full ml-3 flex-shrink-0"
                        style={{ backgroundColor: group.color }}
                      />
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {group._count.people === 0 && 'No members yet'}
                      {group._count.people === 1 && '1 member'}
                      {group._count.people > 1 && `${group._count.people} members`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
