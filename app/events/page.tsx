import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import Navigation from '@/components/Navigation';
import EventList from '@/components/events/EventList';
import { getTranslations } from 'next-intl/server';
import type { DateFormat } from '@/lib/date-format';

export default async function EventsPage() {
  const session = await auth();
  const t = await getTranslations('events');

  if (!session?.user) {
    redirect('/login');
  }

  const [user, events] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { dateFormat: true, nameOrder: true },
    }),
    prisma.event.findMany({
      where: { userId: session.user.id },
      include: {
        people: {
          where: { deletedAt: null },
          select: { id: true, name: true, surname: true, nickname: true, photo: true },
        },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  const dateFormat = (user?.dateFormat ?? 'MDY') as DateFormat;
  const nameOrder = user?.nameOrder;

  // Serialize dates for client components
  const serializedEvents = events.map((e) => ({
    ...e,
    date: e.date.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/events"
      />

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <Link
              href="/events/new"
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50"
            >
              {t('addEvent')}
            </Link>
          </div>

          <EventList
            events={serializedEvents}
            dateFormat={dateFormat}
            nameOrder={nameOrder}
          />
        </div>
      </main>
    </div>
  );
}
