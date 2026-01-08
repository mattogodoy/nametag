import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { prisma } from '@/lib/prisma';
import UnifiedNetworkGraph from '@/components/UnifiedNetworkGraph';
import { formatDate } from '@/lib/date-format';
import { formatFullName } from '@/lib/nameUtils';

interface UpcomingEvent {
  id: string;
  personId: string;
  personName: string;
  type: 'important_date' | 'contact_reminder';
  title: string;
  date: Date;
  daysUntil: number;
}

function getNextOccurrence(eventDate: Date, today: Date): Date {
  const thisYearOccurrence = new Date(
    today.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate()
  );
  thisYearOccurrence.setHours(0, 0, 0, 0);

  const todayNormalized = new Date(today);
  todayNormalized.setHours(0, 0, 0, 0);

  if (thisYearOccurrence.getTime() >= todayNormalized.getTime()) {
    return thisYearOccurrence;
  }

  return new Date(
    today.getFullYear() + 1,
    eventDate.getMonth(),
    eventDate.getDate()
  );
}

function getIntervalMs(interval: number, unit: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  switch (unit) {
    case 'WEEKS':
      return interval * 7 * msPerDay;
    case 'MONTHS':
      return interval * 30 * msPerDay;
    case 'YEARS':
      return interval * 365 * msPerDay;
    default:
      return 30 * msPerDay;
  }
}

function getDaysUntil(date: Date, today: Date): number {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const todayNormalized = new Date(today);
  todayNormalized.setHours(0, 0, 0, 0);
  return Math.round((targetDate.getTime() - todayNormalized.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `In ${days} days`;
  if (days < 14) return 'In 1 week';
  return `In ${Math.floor(days / 7)} weeks`;
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user's date format preference
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true },
  });
  const dateFormat = user?.dateFormat || 'MDY';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // Fetch groups and upcoming events data
  const [groups, importantDates, peopleWithContactReminders, peopleCount] = await Promise.all([
    prisma.group.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.importantDate.findMany({
      where: {
        person: { userId: session.user.id },
        reminderEnabled: true,
      },
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
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
        contactReminderEnabled: true,
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        lastContact: true,
        contactReminderInterval: true,
        contactReminderIntervalUnit: true,
      },
    }),
    prisma.person.count({
      where: { userId: session.user.id },
    }),
  ]);

  // Calculate upcoming events
  const upcomingEvents: UpcomingEvent[] = [];

  // Process important dates
  for (const importantDate of importantDates) {
    let eventDate: Date;

    if (importantDate.reminderType === 'ONCE') {
      eventDate = new Date(importantDate.date);
    } else {
      // Recurring - get next occurrence
      eventDate = getNextOccurrence(new Date(importantDate.date), today);
    }

    const daysUntil = getDaysUntil(eventDate, today);

    if (daysUntil >= 0 && daysUntil <= 30) {
      upcomingEvents.push({
        id: `important-${importantDate.id}`,
        personId: importantDate.person.id,
        personName: formatFullName(importantDate.person),
        type: 'important_date',
        title: importantDate.title,
        date: eventDate,
        daysUntil,
      });
    }
  }

  // Process contact reminders
  for (const person of peopleWithContactReminders) {
    const interval = person.contactReminderInterval || 1;
    const unit = person.contactReminderIntervalUnit || 'MONTHS';
    const intervalMs = getIntervalMs(interval, unit);

    // Calculate when the reminder is due
    const referenceDate = person.lastContact ? new Date(person.lastContact) : null;

    if (referenceDate) {
      const reminderDueDate = new Date(referenceDate.getTime() + intervalMs);
      reminderDueDate.setHours(0, 0, 0, 0);

      const daysUntil = getDaysUntil(reminderDueDate, today);

      // Show if due within next 30 days (or already overdue)
      if (daysUntil <= 30) {
        upcomingEvents.push({
          id: `contact-${person.id}`,
          personId: person.id,
          personName: formatFullName(person),
          type: 'contact_reminder',
          title: 'Time to catch up',
          date: reminderDueDate,
          daysUntil,
        });
      }
    }
  }

  // Sort by days until (soonest first)
  upcomingEvents.sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/dashboard"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="bg-surface shadow-lg rounded-lg p-6 mb-8 border-2 border-primary/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
              <h2 className="text-xl font-bold text-primary mb-4 relative">
                Upcoming Events
              </h2>
              <div className="space-y-3 relative">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/people/${event.personId}`}
                    className="flex items-center justify-between p-4 bg-surface-elevated hover:bg-surface-elevated/80 rounded-lg transition-all border-2 border-border hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 relative group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg shadow-lg ${
                        event.type === 'important_date'
                          ? 'bg-secondary/30 shadow-secondary/20'
                          : 'bg-primary/30 shadow-primary/20'
                      }`}>
                        {event.type === 'important_date' ? (
                          <svg className="w-5 h-5 text-secondary drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-primary drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="text-foreground font-semibold text-base">
                          {event.personName}
                        </div>
                        <div className="text-sm text-muted">
                          {event.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${
                        event.daysUntil <= 0
                          ? 'text-tertiary'
                          : event.daysUntil <= 3
                          ? 'text-secondary'
                          : 'text-primary'
                      }`}>
                        {event.daysUntil < 0 ? 'Overdue' : formatDaysUntil(event.daysUntil)}
                      </div>
                      <div className="text-xs text-muted/80">
                        {formatDate(event.date, dateFormat)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Network Graph */}
          {peopleCount > 0 ? (
            <div className="bg-surface shadow-lg rounded-lg p-6 mb-8 border-2 border-primary/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
              <h2 className="text-xl font-bold text-primary mb-4 relative">
                Your Network
              </h2>
              <div className="relative">
                <UnifiedNetworkGraph
                  apiEndpoint="/api/dashboard/graph"
                  groups={groups}
                  centerNodeNonClickable={true}
                  linkDistance={120}
                  chargeStrength={-400}
                />
              </div>
            </div>
          ) : (
            <div className="bg-surface shadow-lg rounded-lg p-6 mb-8 border-2 border-primary/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
              <div className="text-center py-12 relative">
                <div className="flex justify-center mb-4">
                  <div className="p-6 bg-primary/30 rounded-2xl shadow-lg shadow-primary/20">
                    <svg className="w-16 h-16 text-primary drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">
                  Your network is empty
                </h3>
                <p className="text-base text-muted mb-8 max-w-md mx-auto">
                  Start building your personal network by adding people you know.
                </p>
                <Link
                  href="/people/new"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg shadow-lg bg-primary hover:bg-primary-dark text-black transition-all hover:shadow-primary/50 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  Create your first person
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
