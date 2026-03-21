import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EventForm from '@/components/events/EventForm';
import { getTranslations } from 'next-intl/server';

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('events');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const [user, event, people] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { nameOrder: true },
    }),
    prisma.event.findUnique({
      where: { id },
      include: {
        people: {
          where: { deletedAt: null },
          select: { id: true, name: true, surname: true, nickname: true, photo: true },
        },
      },
    }),
    prisma.person.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, surname: true, nickname: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!event || event.userId !== session.user.id) {
    notFound();
  }

  const serializedEvent = {
    ...event,
    date: event.date.toISOString(),
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/events"
      />

      <main className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/events" className="text-primary hover:underline text-sm">
              ← {t('backToEvents')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg p-6">
            <h1 className="text-2xl font-bold text-foreground mb-6">{t('editEvent')}</h1>
            <EventForm
              mode="edit"
              event={serializedEvent}
              availablePeople={people}
              nameOrder={user?.nameOrder}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
