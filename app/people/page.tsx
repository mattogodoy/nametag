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
  searchParams: Promise<{ page?: string; sortBy?: string; order?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

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

  const totalCount = await prisma.person.count({
    where: {
      userId: session.user.id,
    },
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

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

  const sortedPeople = [...allPeople].sort((a, b) => {
    let primaryComparison = 0;

    switch (sortBy) {
      case 'name':
        primaryComparison = a.name.localeCompare(b.name);
        break;
      case 'surname':
        const aSurname = a.surname || 'zzz';
        const bSurname = b.surname || 'zzz';
        primaryComparison = aSurname.localeCompare(bSurname);
        break;
      case 'nickname':
        const aNickname = a.nickname || 'zzz';
        const bNickname = b.nickname || 'zzz';
        primaryComparison = aNickname.localeCompare(bNickname);
        break;
      case 'relationship':
        const aRel = a.relationshipToUser?.label || 'zzz';
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

    const orderedPrimaryComparison = order === 'desc' ? -primaryComparison : primaryComparison;

    if (orderedPrimaryComparison !== 0) {
      return orderedPrimaryComparison;
    }

    return a.name.localeCompare(b.name);
  });

  const people = sortedPeople.slice(skip, skip + ITEMS_PER_PAGE);

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    params.set('page', page.toString());
    if (sortBy !== 'name') params.set('sortBy', sortBy);
    if (order !== 'asc') params.set('order', order);
    return `/people?${params.toString()}`;
  };

  const SortableHeader = ({ column, label }: { column: string; label: string }) => (
    <Link
      href={`/people?sortBy=${column}&order=${sortBy === column && order === 'asc' ? 'desc' : 'asc'}&page=${currentPage}`}
      className="flex items-center gap-1 hover:text-base-content transition-colors"
    >
      {label}
      {sortBy === column && (
        <span className={`icon-[tabler--chevron-${order === 'asc' ? 'up' : 'down'}] size-4 text-primary`} />
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/people"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">
              People
            </h1>
            <Link href="/people/new" className="btn btn-primary">
              <span className="icon-[tabler--plus] size-5" />
              Add Person
            </Link>
          </div>

          {totalCount === 0 ? (
            <div className="card bg-base-100 shadow-lg">
              <EmptyState
                icon={
                  <div className="bg-primary/20 p-4 rounded-full">
                    <span className="icon-[tabler--users] size-12 text-primary" />
                  </div>
                }
                title="No people yet"
                description="Start building your network by adding people you know. You can track their details, relationships, and stay connected."
                actionLabel="Add Your First Person"
                actionHref="/people/new"
              />
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-base-content/60">
                Showing {skip + 1}-{Math.min(skip + ITEMS_PER_PAGE, totalCount)} of {totalCount} people
              </div>
              <div className="card bg-base-100 shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th><SortableHeader column="name" label="Name" /></th>
                        <th className="hidden md:table-cell"><SortableHeader column="surname" label="Surname" /></th>
                        <th className="hidden lg:table-cell"><SortableHeader column="nickname" label="Nickname" /></th>
                        <th><SortableHeader column="relationship" label="Relationship" /></th>
                        <th><SortableHeader column="group" label="Groups" /></th>
                        <th><SortableHeader column="lastContact" label="Last Contact" /></th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((person) => {
                        const isOrphan = !person.relationshipToUser &&
                                         person.relationshipsFrom.length === 0 &&
                                         person.relationshipsTo.length === 0;

                        return (
                          <tr key={person.id} className="hover">
                            <td>
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/people/${person.id}`}
                                  className="link link-primary font-medium"
                                >
                                  {person.name}
                                </Link>
                                {isOrphan && (
                                  <div className="tooltip tooltip-right" data-tip="This person has no relationships">
                                    <span className="icon-[tabler--alert-triangle] size-4 text-warning" />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="hidden md:table-cell">
                              {person.surname || '—'}
                            </td>
                            <td className="hidden lg:table-cell text-base-content/60">
                              {person.nickname ? `'${person.nickname}'` : '—'}
                            </td>
                            <td>
                              {person.relationshipToUser ? (
                                <span
                                  className="badge badge-sm"
                                  style={{
                                    backgroundColor: person.relationshipToUser.color
                                      ? `${person.relationshipToUser.color}20`
                                      : undefined,
                                    color: person.relationshipToUser.color || undefined,
                                  }}
                                >
                                  {person.relationshipToUser.label}
                                </span>
                              ) : (
                                <span className="badge badge-sm badge-ghost">
                                  Indirect
                                </span>
                              )}
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1">
                                {person.groups.map((pg) => (
                                  <span
                                    key={pg.groupId}
                                    className="badge badge-sm"
                                    style={{
                                      backgroundColor: pg.group.color
                                        ? `${pg.group.color}20`
                                        : undefined,
                                      color: pg.group.color || undefined,
                                    }}
                                  >
                                    {pg.group.name}
                                  </span>
                                ))}
                                {person.groups.length === 0 && (
                                  <span className="text-base-content/40">—</span>
                                )}
                              </div>
                            </td>
                            <td className="text-base-content/60">
                              {person.lastContact
                                ? formatDate(new Date(person.lastContact), dateFormat)
                                : '—'}
                            </td>
                            <td>
                              <div className="flex justify-end gap-1">
                                <Link
                                  href={`/people/${person.id}/edit`}
                                  className="btn btn-ghost btn-square btn-sm"
                                  title="Edit"
                                >
                                  <span className="icon-[tabler--edit] size-4" />
                                </Link>
                                <Link
                                  href={`/people/${person.id}`}
                                  className="btn btn-ghost btn-square btn-sm"
                                  title="View"
                                >
                                  <span className="icon-[tabler--eye] size-4" />
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
                  <div className="border-t border-base-content/10 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-base-content/60">
                        Page {currentPage} of {totalPages}
                      </p>
                      <div className="join">
                        {currentPage > 1 ? (
                          <Link href={buildUrl(currentPage - 1)} className="join-item btn btn-sm">
                            <span className="icon-[tabler--chevron-left] size-4" />
                          </Link>
                        ) : (
                          <button className="join-item btn btn-sm btn-disabled">
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
                            <button key={pageNum} className="join-item btn btn-sm btn-active">
                              {pageNum}
                            </button>
                          ) : (
                            <Link key={pageNum} href={buildUrl(pageNum)} className="join-item btn btn-sm">
                              {pageNum}
                            </Link>
                          );
                        })}

                        {currentPage < totalPages ? (
                          <Link href={buildUrl(currentPage + 1)} className="join-item btn btn-sm">
                            <span className="icon-[tabler--chevron-right] size-4" />
                          </Link>
                        ) : (
                          <button className="join-item btn btn-sm btn-disabled">
                            <span className="icon-[tabler--chevron-right] size-4" />
                          </button>
                        )}
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
