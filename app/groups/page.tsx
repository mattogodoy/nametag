import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';
import { canCreateResource } from '@/lib/billing/subscription';

const ITEMS_PER_PAGE = 24;

export default async function GroupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user can create more groups
  const canCreate = await canCreateResource(session.user.id, 'groups');

  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  // Get total count for pagination
  const totalCount = await prisma.group.count({
    where: {
      userId: session.user.id,
    },
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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
    skip,
    take: ITEMS_PER_PAGE,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              Groups
            </h1>
            {canCreate.allowed ? (
              <Link
                href="/groups/new"
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50"
              >
                Add Group
              </Link>
            ) : (
              <div className="relative group">
                <span className="px-4 py-2 bg-gray-400 dark:bg-gray-600 text-white rounded-lg font-semibold cursor-not-allowed inline-block">
                  Add Group
                </span>
                <div className="invisible group-hover:visible absolute right-0 top-full mt-2 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg z-10">
                  <p className="mb-2">You&apos;ve reached the limit of {canCreate.limit} groups.</p>
                  <Link href="/settings/billing" className="text-blue-400 hover:text-blue-300 underline">
                    Upgrade your plan
                  </Link>
                </div>
              </div>
            )}
          </div>

          {totalCount === 0 ? (
            <div className="bg-surface shadow rounded-lg">
              <EmptyState
                icon={
                  <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                    <svg className="w-12 h-12 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                }
                title="No groups yet"
                description="Create groups to organize your network. Groups help you categorize people by family, friends, work, or any custom category."
                actionLabel="Create Your First Group"
                actionHref="/groups/new"
              />
            </div>
          ) : (
            <>
              {totalPages > 1 && (
                <div className="mb-4 text-sm text-muted">
                  Showing {skip + 1}-{Math.min(skip + ITEMS_PER_PAGE, totalCount)} of {totalCount} groups
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="bg-surface shadow rounded-lg p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-foreground mb-1">
                          {group.name}
                        </h3>
                        {group.description && (
                          <p className="text-sm text-muted">
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
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted">
                        {group._count.people === 0 && 'No members yet'}
                        {group._count.people === 1 && '1 member'}
                        {group._count.people > 1 && `${group._count.people} members`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center">
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {currentPage > 1 ? (
                      <Link
                        href={`/groups?page=${currentPage - 1}`}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-surface text-sm font-medium text-muted hover:bg-surface-elevated"
                      >
                        <span className="sr-only">Previous</span>
                        ←
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border bg-surface-elevated text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">
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
                          className="relative inline-flex items-center px-4 py-2 border border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-sm font-medium text-primary"
                        >
                          {pageNum}
                        </span>
                      ) : (
                        <Link
                          key={pageNum}
                          href={`/groups?page=${pageNum}`}
                          className="relative inline-flex items-center px-4 py-2 border border-border bg-surface text-sm font-medium text-muted hover:bg-surface-elevated"
                        >
                          {pageNum}
                        </Link>
                      );
                    })}

                    {currentPage < totalPages ? (
                      <Link
                        href={`/groups?page=${currentPage + 1}`}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-surface text-sm font-medium text-muted hover:bg-surface-elevated"
                      >
                        <span className="sr-only">Next</span>
                        →
                      </Link>
                    ) : (
                      <span className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border bg-surface-elevated text-sm font-medium text-gray-400 dark:text-gray-600 cursor-not-allowed">
                        <span className="sr-only">Next</span>
                        →
                      </span>
                    )}
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
