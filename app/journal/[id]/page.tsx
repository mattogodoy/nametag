import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { formatGraphName, type NameDisplayFormat } from '@/lib/nameUtils';
import { Button } from '@/components/ui/Button';
import DeleteJournalEntryButton from '@/components/DeleteJournalEntryButton';

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('journal');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [entry, user] = await Promise.all([
    prisma.journalEntry.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        people: {
          where: { person: { deletedAt: null } },
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
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nameOrder: true, nameDisplayFormat: true, language: true, dateFormat: true },
    }),
  ]);

  if (!entry) {
    notFound();
  }

  const nameOrder = user?.nameOrder ?? 'WESTERN';
  const nameDisplayFormat = (user?.nameDisplayFormat || 'FULL') as NameDisplayFormat;
  const locale = user?.language ?? 'en';

  const formattedDate = entry.date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
          <div className="mb-6">
            <Link
              href="/journal"
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              ← {t('title')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-1">
                  {entry.title}
                </h1>
                <p className="text-sm text-muted">{formattedDate}</p>
              </div>
              <div className="flex gap-2">
                <Button href={`/journal/${entry.id}/edit`} size="sm" variant="secondary">
                  {t('detail.editButton')}
                </Button>
                <DeleteJournalEntryButton entryId={entry.id} />
              </div>
            </div>

            {entry.people.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  {t('detail.taggedPeople')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {entry.people.map(({ person }) => (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                      {formatGraphName(person, nameOrder, nameDisplayFormat)}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <article className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={entry.body} />
            </article>
          </div>
        </div>
      </main>
    </div>
  );
}
