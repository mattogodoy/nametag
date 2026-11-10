import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import CalendarMonth from '@/components/calendar/CalendarMonth';
import { getCalendarEvents } from '@/lib/calendar-events';
import { parseMonthParam } from '@/lib/calendar-month';

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const { year, monthIndex } = parseMonthParam(params.month);
  const events = await getCalendarEvents(session.user.id, year, monthIndex);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/calendar"
      />
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <CalendarMonth
          year={year}
          monthIndex={monthIndex}
          events={events}
          isDefaultMonth={params.month === undefined}
        />
      </main>
    </div>
  );
}
