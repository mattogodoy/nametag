import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import JournalTimeline from '@/components/JournalTimeline';

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; q?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('journal');

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const personFilter = params.person;
  const searchQuery = params.q;

  const [user, people, entries] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nameOrder: true, language: true },
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.journalEntry.findMany({
      where: {
        userId: session.user.id,
        deletedAt: null,
        ...(personFilter
          ? {
              people: {
                some: { personId: personFilter },
              },
            }
          : {}),
        ...(searchQuery
          ? {
              OR: [
                { title: { contains: searchQuery, mode: 'insensitive' } },
                { body: { contains: searchQuery, mode: 'insensitive' } },
              ],
            }
          : {}),
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
      orderBy: { date: 'desc' },
    }),
  ]);

  const nameOrder = user?.nameOrder ?? 'WESTERN';
  const locale = user?.language ?? 'en';

  // Serialize Date objects to ISO strings for client components
  const serializedEntries = entries.map((entry) => ({
    ...entry,
    date: entry.date.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/journal"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              {t('title')}
            </h1>
            <Link
              href="/journal/new"
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
            >
              {t('addEntry')}
            </Link>
          </div>

          <div className="flex gap-3 mb-6">
            <form action="/journal" method="get" className="flex-1">
              {personFilter && <input type="hidden" name="person" value={personFilter} />}
              <input
                type="search"
                name="q"
                defaultValue={searchQuery ?? ''}
                placeholder={t('searchPlaceholder')}
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </form>
            <form action="/journal" method="get">
              {searchQuery && <input type="hidden" name="q" value={searchQuery} />}
              <select
                name="person"
                defaultValue={personFilter ?? ''}
                onChange={(e) => (e.target.closest('form') as HTMLFormElement)?.submit()}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">{t('allPeople')}</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.nickname ?? person.name}
                    {person.surname ? ` ${person.surname}` : ''}
                  </option>
                ))}
              </select>
            </form>
          </div>

          <JournalTimeline
            entries={serializedEntries}
            nameOrder={nameOrder}
            locale={locale}
          />
        </div>
      </main>
    </div>
  );
}
