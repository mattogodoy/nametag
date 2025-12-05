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

  // Fetch statistics, groups, and upcoming events data
  const [peopleCount, groupsCount, relationshipsCount, groups, importantDates, peopleWithContactReminders] = await Promise.all([
    prisma.person.count({
      where: { userId: session.user.id },
    }),
    prisma.group.count({
      where: { userId: session.user.id },
    }),
    prisma.relationship.count({
      where: {
        person: { userId: session.user.id },
      },
    }),
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/dashboard"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
            <Link
              href="/people"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total People
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900 dark:text-white">
                        {peopleCount}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/groups"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                      <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Groups
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900 dark:text-white">
                        {groupsCount}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>

            <Link
              href="/relationship-types"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Relationships
                      </dt>
                      <dd className="text-3xl font-semibold text-gray-900 dark:text-white">
                        {relationshipsCount}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Network Graph */}
          {peopleCount > 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Your Network
              </h2>
              <UnifiedNetworkGraph
                apiEndpoint="/api/dashboard/graph"
                groups={groups}
                centerNodeNonClickable={true}
                linkDistance={120}
                chargeStrength={-400}
              />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <div className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    <svg className="w-12 h-12 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Your network is empty
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Start building your personal network by adding people you know.
                </p>
                <Link
                  href="/people/new"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create your first person
                </Link>
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Upcoming Events
              </h2>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/people/${event.personId}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        event.type === 'important_date'
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {event.type === 'important_date' ? (
                          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {event.personName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {event.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${
                        event.daysUntil <= 0
                          ? 'text-red-600 dark:text-red-400'
                          : event.daysUntil <= 3
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {event.daysUntil < 0 ? 'Overdue' : formatDaysUntil(event.daysUntil)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(event.date, dateFormat)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
