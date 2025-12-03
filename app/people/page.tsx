import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/date-format';

const ITEMS_PER_PAGE = 50;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user's date format preference
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true },
  });
  const dateFormat = user?.dateFormat || 'MDY';

  const currentPage = Number(searchParams.page) || 1;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  // Get total count for pagination
  const totalCount = await prisma.person.count({
    where: {
      userId: session.user.id,
    },
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const people = await prisma.person.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      relationshipToUser: {
        select: {
          label: true,
          color: true,
        },
      },
      groups: {
        include: {
          group: {
            select: {
              name: true,
              color: true,
            },
          },
        },
      },
      relationshipsFrom: {
        select: {
          id: true,
        },
      },
      relationshipsTo: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      fullName: 'asc',
    },
    skip,
    take: ITEMS_PER_PAGE,
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/people"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              People
            </h1>
            <Link
              href="/people/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Add Person
            </Link>
          </div>

          {totalCount === 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
              <EmptyState
                icon="👥"
                title="No people yet"
                description="Start building your network by adding people you know. You can track their details, relationships, and stay connected."
                actionLabel="Add Your First Person"
                actionHref="/people/new"
              />
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Showing {skip + 1}-{Math.min(skip + ITEMS_PER_PAGE, totalCount)} of {totalCount} people
              </div>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Relationship
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Groups
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Last Contact
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {people.map((person) => {
                    const isOrphan = !person.relationshipToUser &&
                                     person.relationshipsFrom.length === 0 &&
                                     person.relationshipsTo.length === 0;

                    return (
                    <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/people/${person.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {person.fullName}
                          </Link>
                          {isOrphan && (
                            <span className="relative group cursor-help">
                              <span className="text-yellow-500">⚠️</span>
                              <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg whitespace-normal max-w-xs z-50 shadow-lg">
                                This person has no relationships and will be shown as isolated in the network graph
                                <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {person.relationshipToUser ? (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                            style={{
                              backgroundColor: person.relationshipToUser.color
                                ? `${person.relationshipToUser.color}20`
                                : '#E5E7EB',
                              color: person.relationshipToUser.color || '#374151',
                            }}
                          >
                            {person.relationshipToUser.label}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                            Indirect
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {person.groups.map((pg) => (
                            <span
                              key={pg.groupId}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                              style={{
                                backgroundColor: pg.group.color
                                  ? `${pg.group.color}20`
                                  : '#E5E7EB',
                                color: pg.group.color || '#374151',
                              }}
                            >
                              {pg.group.name}
                            </span>
                          ))}
                          {person.groups.length === 0 && (
                            <span className="text-sm text-gray-400 dark:text-gray-500">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {person.lastContact
                          ? formatDate(new Date(person.lastContact), dateFormat)
                          : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/people/${person.id}/edit`}
                          className="text-blue-600 dark:text-blue-400 hover:underline mr-4"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/people/${person.id}`}
                          className="text-gray-600 dark:text-gray-400 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              {totalPages > 1 && (
                <div className="bg-white dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 flex justify-between sm:hidden">
                      {currentPage > 1 ? (
                        <Link
                          href={`/people?page=${currentPage - 1}`}
                          className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Previous
                        </Link>
                      ) : (
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-900 cursor-not-allowed">
                          Previous
                        </span>
                      )}
                      {currentPage < totalPages ? (
                        <Link
                          href={`/people?page=${currentPage + 1}`}
                          className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Next
                        </Link>
                      ) : (
                        <span className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-900 cursor-not-allowed">
                          Next
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Page <span className="font-medium">{currentPage}</span> of{' '}
                          <span className="font-medium">{totalPages}</span>
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                          {currentPage > 1 ? (
                            <Link
                              href={`/people?page=${currentPage - 1}`}
                              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <span className="sr-only">Previous</span>
                              ←
                            </Link>
                          ) : (
                            <span className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">
                              <span className="sr-only">Previous</span>
                              ←
                            </span>
                          )}

                          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 7) {
                              pageNum = i + 1;
                            } else if (currentPage <= 4) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 3) {
                              pageNum = totalPages - 6 + i;
                            } else {
                              pageNum = currentPage - 3 + i;
                            }

                            return pageNum === currentPage ? (
                              <span
                                key={pageNum}
                                className="relative inline-flex items-center px-4 py-2 border border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-sm font-medium text-blue-600 dark:text-blue-400"
                              >
                                {pageNum}
                              </span>
                            ) : (
                              <Link
                                key={pageNum}
                                href={`/people?page=${pageNum}`}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                {pageNum}
                              </Link>
                            );
                          })}

                          {currentPage < totalPages ? (
                            <Link
                              href={`/people?page=${currentPage + 1}`}
                              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                              <span className="sr-only">Next</span>
                              →
                            </Link>
                          ) : (
                            <span className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">
                              <span className="sr-only">Next</span>
                              →
                            </span>
                          )}
                        </nav>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
