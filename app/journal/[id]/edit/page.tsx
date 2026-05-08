import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import Navigation from '@/components/Navigation';
import JournalEntryForm from '@/components/JournalEntryForm';

export default async function EditJournalEntryPage({
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

  const [entry, user, availablePeople] = await Promise.all([
    prisma.journalEntry.findUnique({
      where: {
        id,
        userId: session.user.id,
        deletedAt: null,
      },
      include: {
        people: {
          where: { person: { deletedAt: null } },
          select: { personId: true },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nameOrder: true, dateFormat: true },
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
  ]);

  if (!entry) {
    notFound();
  }

  const nameOrder = (user?.nameOrder ?? 'WESTERN') as 'WESTERN' | 'EASTERN';
  const dateFormat = (user?.dateFormat ?? 'MDY') as 'MDY' | 'DMY' | 'YMD';

  const initialData = {
    title: entry.title,
    dateIso: entry.date.toISOString(),
    hasTime: entry.hasTime,
    body: entry.body,
    personIds: entry.people.map((p) => p.personId),
  };

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
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {t('editEntry')}
          </h1>

          <div className="bg-surface shadow rounded-lg p-6">
            <JournalEntryForm
              mode="edit"
              entryId={entry.id}
              initialData={initialData}
              availablePeople={availablePeople}
              nameOrder={nameOrder}
              dateFormat={dateFormat}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
