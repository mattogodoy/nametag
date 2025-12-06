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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true },
  });
  const dateFormat = user?.dateFormat || 'MDY';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

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

  const upcomingEvents: UpcomingEvent[] = [];

  for (const importantDate of importantDates) {
    let eventDate: Date;

    if (importantDate.reminderType === 'ONCE') {
      eventDate = new Date(importantDate.date);
    } else {
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

  for (const person of peopleWithContactReminders) {
    const interval = person.contactReminderInterval || 1;
    const unit = person.contactReminderIntervalUnit || 'MONTHS';
    const intervalMs = getIntervalMs(interval, unit);

    const referenceDate = person.lastContact ? new Date(person.lastContact) : null;

    if (referenceDate) {
      const reminderDueDate = new Date(referenceDate.getTime() + intervalMs);
      reminderDueDate.setHours(0, 0, 0, 0);

      const daysUntil = getDaysUntil(reminderDueDate, today);

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

  upcomingEvents.sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/dashboard"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Statistics Cards */}
          <div className="stats stats-vertical lg:stats-horizontal shadow w-full mb-8">
            <Link href="/people" className="stat hover:bg-base-300 transition-colors">
              <div className="stat-figure text-primary">
                <span className="icon-[tabler--users] size-8" />
              </div>
              <div className="stat-title">Total People</div>
              <div className="stat-value text-primary">{peopleCount}</div>
            </Link>

            <Link href="/groups" className="stat hover:bg-base-300 transition-colors">
              <div className="stat-figure text-secondary">
                <span className="icon-[tabler--folders] size-8" />
              </div>
              <div className="stat-title">Groups</div>
              <div className="stat-value text-secondary">{groupsCount}</div>
            </Link>

            <Link href="/relationship-types" className="stat hover:bg-base-300 transition-colors">
              <div className="stat-figure text-accent">
                <span className="icon-[tabler--heart-handshake] size-8" />
              </div>
              <div className="stat-title">Relationships</div>
              <div className="stat-value text-accent">{relationshipsCount}</div>
            </Link>
          </div>

          {/* Network Graph */}
          {peopleCount > 0 ? (
            <div className="card bg-base-100 shadow-lg mb-8">
              <div className="card-body">
                <h2 className="card-title">
                  <span className="icon-[tabler--network] size-6" />
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
            </div>
          ) : (
            <div className="card bg-base-100 shadow-lg mb-8">
              <div className="card-body items-center text-center py-12">
                <div className="bg-primary/10 p-4 rounded-full mb-4">
                  <span className="icon-[tabler--users] size-12 text-primary" />
                </div>
                <h3 className="card-title">Your network is empty</h3>
                <p className="text-base-content/60 max-w-md">
                  Start building your personal network by adding people you know.
                </p>
                <div className="card-actions mt-4">
                  <Link href="/people/new" className="btn btn-primary">
                    <span className="icon-[tabler--plus] size-5" />
                    Create your first person
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="card bg-base-100 shadow-lg mb-8">
              <div className="card-body">
                <h2 className="card-title">
                  <span className="icon-[tabler--calendar-event] size-6" />
                  Upcoming Events
                </h2>
                <div className="divide-y divide-base-content/10">
                  {upcomingEvents.map((event) => (
                    <Link
                      key={event.id}
                      href={`/people/${event.personId}`}
                      className="flex items-center justify-between py-3 hover:bg-base-200 -mx-4 px-4 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          event.type === 'important_date'
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-primary/20 text-primary'
                        }`}>
                          {event.type === 'important_date' ? (
                            <span className="icon-[tabler--calendar] size-4" />
                          ) : (
                            <span className="icon-[tabler--bell] size-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{event.personName}</div>
                          <div className="text-sm text-base-content/60">{event.title}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          event.daysUntil <= 0
                            ? 'text-error'
                            : event.daysUntil <= 3
                            ? 'text-warning'
                            : 'text-base-content/60'
                        }`}>
                          {event.daysUntil < 0 ? 'Overdue' : formatDaysUntil(event.daysUntil)}
                        </div>
                        <div className="text-xs text-base-content/50">
                          {formatDate(event.date, dateFormat)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
