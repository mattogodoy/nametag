import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeleteGroupButton from '@/components/DeleteGroupButton';
import Navigation from '@/components/Navigation';

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

  const group = await prisma.group.findUnique({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      people: {
        include: {
          person: true,
        },
      },
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

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
              <div className="flex items-center">
                {group.color && (
                  <div
                    className="w-12 h-12 rounded-full mr-4 flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {group.name}
                  </h1>
                  {group.description && (
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex space-x-3">
                <Link
                  href={`/groups/${group.id}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Edit
                </Link>
                <DeleteGroupButton groupId={group.id} groupName={group.name} />
              </div>
            </div>

            <div className="px-6 py-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Members ({group.people.length})
              </h2>

              {group.people.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No members in this group yet.
                  </p>
                  <Link
                    href="/people/new"
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Add People
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.people.map((pg) => (
                    <Link
                      key={pg.person.id}
                      href={`/people/${pg.person.id}`}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {pg.person.fullName}
                        </h3>
                        {pg.person.phone && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {pg.person.phone}
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
