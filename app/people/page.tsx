import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';
import { formatDate } from '@/lib/date-format';
import { formatFullName } from '@/lib/nameUtils';

const ITEMS_PER_PAGE = 50;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sortBy?: string; order?: string }>;
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

  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const sortBy = params.sortBy || 'name';
  const order = params.order || 'asc';
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  // Get total count for pagination
  const totalCount = await prisma.person.count({
    where: {
      userId: session.user.id,
    },
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch all people for this user (we'll sort and paginate in memory)
  const allPeople = await prisma.person.findMany({
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
  });

  // Sort the people based on sortBy and order
  const sortedPeople = [...allPeople].sort((a, b) => {
    let primaryComparison = 0;

    switch (sortBy) {
      case 'name':
        primaryComparison = a.name.localeCompare(b.name);
        break;
      case 'surname':
        const aSurname = a.surname || 'zzz'; // Put people without surnames at the end
        const bSurname = b.surname || 'zzz';
        primaryComparison = aSurname.localeCompare(bSurname);
        break;
      case 'nickname':
        const aNickname = a.nickname || 'zzz'; // Put people without nicknames at the end
        const bNickname = b.nickname || 'zzz';
        primaryComparison = aNickname.localeCompare(bNickname);
        break;
      case 'relationship':
        const aRel = a.relationshipToUser?.label || 'zzz'; // Put indirect relationships at the end
        const bRel = b.relationshipToUser?.label || 'zzz';
        primaryComparison = aRel.localeCompare(bRel);
        break;
      case 'group':
        const aGroup = a.groups[0]?.group.name || 'zzz';
        const bGroup = b.groups[0]?.group.name || 'zzz';
        primaryComparison = aGroup.localeCompare(bGroup);
        break;
      case 'lastContact':
        const aDate = a.lastContact ? new Date(a.lastContact).getTime() : 0;
        const bDate = b.lastContact ? new Date(b.lastContact).getTime() : 0;
        primaryComparison = aDate - bDate;
        break;
      default:
        primaryComparison = a.name.localeCompare(b.name);
    }

    // Apply order to primary comparison only
    const orderedPrimaryComparison = order === 'desc' ? -primaryComparison : primaryComparison;

    // If primary comparison is not equal, return it
    if (orderedPrimaryComparison !== 0) {
      return orderedPrimaryComparison;
    }

    // Otherwise, use secondary sort by name (always ascending)
    return a.name.localeCompare(b.name);
  });

  // Paginate the sorted results
  const people = sortedPeople.slice(skip, skip + ITEMS_PER_PAGE);

  // Helper function to build URLs with sort parameters
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (sortBy !== 'name') params.set('sortBy', sortBy);
    if (order !== 'asc') params.set('order', order);
    return `/people?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
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
                      <Link
                        href={`/people?sortBy=name&order=${sortBy === 'name' && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
                        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100"
                      >
                        Name
                        {sortBy === 'name' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {order === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Link>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <Link
                        href={`/people?sortBy=surname&order=${sortBy === 'surname' && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
                        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100"
                      >
                        Surname
                        {sortBy === 'surname' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {order === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Link>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <Link
                        href={`/people?sortBy=nickname&order=${sortBy === 'nickname' && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
                        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100"
                      >
                        Nickname
                        {sortBy === 'nickname' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {order === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Link>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <Link
                        href={`/people?sortBy=relationship&order=${sortBy === 'relationship' && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
                        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100"
                      >
                        Relationship
                        {sortBy === 'relationship' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {order === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Link>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <Link
                        href={`/people?sortBy=group&order=${sortBy === 'group' && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
                        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100"
                      >
                        Groups
                        {sortBy === 'group' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {order === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Link>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <Link
                        href={`/people?sortBy=lastContact&order=${sortBy === 'lastContact' && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
                        className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-100"
                      >
                        Last Contact
                        {sortBy === 'lastContact' && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {order === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </Link>
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
                            {person.name}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {person.surname || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {person.nickname ? `'${person.nickname}'` : '—'}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-3">
                          <Link
                            href={`/people/${person.id}/edit`}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/people/${person.id}`}
                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                            title="View"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        </div>
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
                          href={buildUrl(currentPage - 1)}
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
                          href={buildUrl(currentPage + 1)}
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
                              href={buildUrl(currentPage - 1)}
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
                                href={buildUrl(pageNum)}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                {pageNum}
                              </Link>
                            );
                          })}

                          {currentPage < totalPages ? (
                            <Link
                              href={buildUrl(currentPage + 1)}
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
