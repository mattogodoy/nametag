import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EmptyState from '@/components/EmptyState';
import ImportSuccessToast from '@/components/ImportSuccessToast';
import { canCreateResource } from '@/lib/billing/subscription';
import { getTranslations } from 'next-intl/server';
import PeopleListClient from '@/components/PeopleListClient';

const ITEMS_PER_PAGE = 50;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sortBy?: string; order?: string; group?: string; relationship?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('people');
  const tCommon = await getTranslations('common');

  if (!session?.user) {
    redirect('/login');
  }

  // Check if user can create more people
  const canCreate = await canCreateResource(session.user.id, 'people');

  // Fetch user's date format preference
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true, nameOrder: true },
  });
  const dateFormat = user?.dateFormat || 'MDY';
  const nameOrder = user?.nameOrder || 'WESTERN';

  const params = await searchParams;
  const currentPage = Number(params.page) || 1;
  const sortBy = params.sortBy || 'name';
  const order = params.order || 'asc';
  const groupFilter = params.group || '';
  const relationshipFilter = params.relationship || '';
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  // Build where clause for people query
  const peopleWhere: {
    userId: string;
    deletedAt: null;
    groups?: { none: Record<string, never> } | { some: { groupId: string } };
    relationshipToUserId?: string | null;
  } = {
    userId: session.user.id,
    deletedAt: null,
  };

  if (groupFilter === 'none') {
    peopleWhere.groups = { none: {} };
  } else if (groupFilter) {
    peopleWhere.groups = { some: { groupId: groupFilter } };
  }

  if (relationshipFilter === 'none') {
    peopleWhere.relationshipToUserId = null;
  } else if (relationshipFilter) {
    peopleWhere.relationshipToUserId = relationshipFilter;
  }

  // Get total count for pagination
  const totalCount = await prisma.person.count({
    where: peopleWhere,
  });

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Fetch all people, groups, and relationship types in parallel
  const [allPeople, allGroups, relationshipTypes] = await Promise.all([
    prisma.person.findMany({
      where: peopleWhere,
      include: {
        relationshipToUser: { select: { label: true, color: true } },
        groups: { include: { group: { select: { name: true, color: true } } } },
        relationshipsFrom: { select: { id: true } },
        relationshipsTo: { select: { id: true } },
      },
    }),
    prisma.group.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
    prisma.relationshipType.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { label: 'asc' },
      select: { id: true, label: true, color: true },
    }),
  ]);

  // Sort the people based on sortBy and order
  const sortedPeople = [...allPeople].sort((a, b) => {
    let primaryComparison = 0;

    switch (sortBy) {
      case 'name': {
        const aFullName = `${a.name} ${a.surname || ''}`.trim();
        const bFullName = `${b.name} ${b.surname || ''}`.trim();
        primaryComparison = aFullName.localeCompare(bFullName);
        break;
      }
      case 'surname': {
        const aFullName = `${a.name} ${a.surname || ''}`.trim();
        const bFullName = `${b.name} ${b.surname || ''}`.trim();
        primaryComparison = aFullName.localeCompare(bFullName);
        break;
      }
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
      default: {
        const aFull = `${a.name} ${a.surname || ''}`.trim();
        const bFull = `${b.name} ${b.surname || ''}`.trim();
        primaryComparison = aFull.localeCompare(bFull);
      }
    }

    // Apply order to primary comparison only
    const orderedPrimaryComparison = order === 'desc' ? -primaryComparison : primaryComparison;

    // If primary comparison is not equal, return it
    if (orderedPrimaryComparison !== 0) {
      return orderedPrimaryComparison;
    }

    // Otherwise, use secondary sort by full name (always ascending)
    const aFallback = `${a.name} ${a.surname || ''}`.trim();
    const bFallback = `${b.name} ${b.surname || ''}`.trim();
    return aFallback.localeCompare(bFallback);
  });

  // Paginate the sorted results
  const people = sortedPeople.slice(skip, skip + ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/people"
      />
      <Suspense>
        <ImportSuccessToast />
      </Suspense>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {t('title')}
            </h1>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/people/duplicates"
                className="px-4 py-2 border border-border text-foreground rounded-lg font-semibold hover:bg-surface transition-colors"
              >
                {t('duplicates.findDuplicates')}
              </Link>
              {canCreate.allowed ? (
                <Link
                  href="/people/new"
                  className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
                >
                  {t('addPerson')}
                </Link>
              ) : (
                <div className="relative group">
                  <span className="px-4 py-2 bg-muted/50 text-white rounded-lg font-semibold cursor-not-allowed inline-block">
                    {t('addPerson')}
                  </span>
                  <div className="invisible group-hover:visible absolute right-0 top-full mt-2 w-64 p-3 bg-surface-elevated text-white text-sm rounded-lg shadow-lg z-10">
                    <p className="mb-2">{t('limitReached', { limit: canCreate.limit })}</p>
                    <Link href="/settings/billing" className="text-primary hover:text-primary-dark underline">
                      {t('upgradePlan')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {totalCount === 0 && !groupFilter && !relationshipFilter ? (
            <div className="bg-surface rounded-lg border border-border">
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                title={t('noPeopleYet')}
                description={t('noPeopleDescription')}
                actionLabel={t('addFirstPerson')}
                actionHref="/people/new"
              />
            </div>
          ) : (
            <>
              <PeopleListClient
                people={people}
                totalCount={totalCount}
                currentPage={currentPage}
                totalPages={totalPages}
                sortBy={sortBy}
                order={order}
                groupFilter={groupFilter}
                relationshipFilter={relationshipFilter}
                dateFormat={dateFormat}
                availableGroups={allGroups}
                relationshipTypes={relationshipTypes}
                nameOrder={nameOrder}
                translations={{
                  surname: t('surname'),
                  nickname: t('nickname'),
                  relationshipToUser: t('relationshipToUser'),
                  groups: t('groups'),
                  lastContact: t('lastContact'),
                  actions: t('actions'),
                  indirect: t('indirect'),
                  orphanWarning: t('orphanWarning'),
                  showing: t('showing', { start: totalCount === 0 ? 0 : skip + 1, end: Math.min(skip + ITEMS_PER_PAGE, totalCount), total: totalCount }),
                  page: t('page'),
                  of: t('of'),
                }}
                commonTranslations={{
                  name: tCommon('name'),
                  edit: tCommon('edit'),
                  view: tCommon('view'),
                  previous: tCommon('previous'),
                  next: tCommon('next'),
                }}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
