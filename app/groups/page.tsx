import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';

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

  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

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
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/groups"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">
              Groups
            </h1>
            <Link href="/groups/new" className="btn btn-primary">
              <span className="icon-[tabler--plus] size-5" />
              Add Group
            </Link>
          </div>

          {totalCount === 0 ? (
            <div className="card bg-base-100 shadow-lg">
              <EmptyState
                icon={
                  <div className="bg-secondary/20 p-4 rounded-full">
                    <span className="icon-[tabler--folders] size-12 text-secondary" />
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
                <div className="mb-4 text-sm text-base-content/60">
                  Showing {skip + 1}-{Math.min(skip + ITEMS_PER_PAGE, totalCount)} of {totalCount} groups
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.map((group) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <div className="card-body">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="card-title text-lg">
                            {group.name}
                          </h3>
                          {group.description && (
                            <p className="text-sm text-base-content/60">
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
                      <div className="divider my-2"></div>
                      <div className="flex items-center gap-2 text-base-content/60">
                        <span className="icon-[tabler--users] size-4" />
                        <span className="text-sm">
                          {group._count.people === 0 && 'No members yet'}
                          {group._count.people === 1 && '1 member'}
                          {group._count.people > 1 && `${group._count.people} members`}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <div className="join">
                    {currentPage > 1 ? (
                      <Link
                        href={`/groups?page=${currentPage - 1}`}
                        className="join-item btn"
                      >
                        <span className="icon-[tabler--chevron-left] size-4" />
                      </Link>
                    ) : (
                      <button className="join-item btn btn-disabled">
                        <span className="icon-[tabler--chevron-left] size-4" />
                      </button>
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
                        <button key={pageNum} className="join-item btn btn-active">
                          {pageNum}
                        </button>
                      ) : (
                        <Link
                          key={pageNum}
                          href={`/groups?page=${pageNum}`}
                          className="join-item btn"
                        >
                          {pageNum}
                        </Link>
                      );
                    })}

                    {currentPage < totalPages ? (
                      <Link
                        href={`/groups?page=${currentPage + 1}`}
                        className="join-item btn"
                      >
                        <span className="icon-[tabler--chevron-right] size-4" />
                      </Link>
                    ) : (
                      <button className="join-item btn btn-disabled">
                        <span className="icon-[tabler--chevron-right] size-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
