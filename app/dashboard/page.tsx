import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { prisma } from '@/lib/prisma';
import UnifiedNetworkGraph from '@/components/UnifiedNetworkGraph';
import { formatDate, formatDateWithoutYear } from '@/lib/date-format';
import { getUpcomingEvents } from '@/lib/upcoming-events';
import { getTranslations } from 'next-intl/server';
import PersonAvatar from '@/components/PersonPhoto';

export default async function DashboardPage() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user's date format preference
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true },
  });
  const dateFormat = user?.dateFormat || 'MDY';

  // Fetch groups, upcoming events, and people count
  const [groups, upcomingEvents, peopleCount] = await Promise.all([
    prisma.group.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { name: 'asc' },
    }),
    getUpcomingEvents(session.user.id),
    prisma.person.count({
      where: { userId: session.user.id, deletedAt: null },
    }),
  ]);

  // Time-of-day greeting
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'greetingMorning' : hour < 18 ? 'greetingAfternoon' : 'greetingEvening';

  // Helper function to format days until
  const formatDaysUntil = (days: number): string => {
    if (days === 0) return t('today');
    if (days === 1) return t('tomorrow');
    if (days < 7) return t('inDays', { days });
    if (days < 14) return t('inWeek');
    return t('inWeeks', { weeks: Math.floor(days / 7) });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        userPhoto={session.user.photo}
        currentPath="/dashboard"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Greeting */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">
              {t(greetingKey, { name: session.user.nickname || session.user.name || '' })}
            </h1>
          </div>

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <div className="bg-surface rounded-lg p-6 mb-8 border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {t('upcomingEvents')}
              </h2>
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/people/${event.personId}`}
                    className="flex items-center justify-between p-4 bg-surface-elevated hover:bg-surface-elevated/80 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <PersonAvatar personId={event.personId} name={event.personName} photo={event.personPhoto} size={40} />
                      <div>
                        <div className="text-foreground font-semibold">
                          {event.personName}
                        </div>
                        <div className="text-sm text-muted">
                          {event.titleKey ? t(event.titleKey) : event.title}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${
                        event.daysUntil <= 0
                          ? 'text-warning'
                          : event.daysUntil <= 3
                          ? 'text-accent'
                          : 'text-muted'
                      }`}>
                        {event.daysUntil < 0 ? t('overdue') : formatDaysUntil(event.daysUntil)}
                      </div>
                      <div className="text-xs text-muted">
                        {event.isYearUnknown
                          ? formatDateWithoutYear(event.date, dateFormat)
                          : formatDate(event.date, dateFormat)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Network Graph */}
          {peopleCount > 0 ? (
            <div className="bg-surface rounded-lg p-6 mb-8 border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">
                {t('yourNetwork')}
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
            <div className="bg-surface rounded-lg p-6 mb-8 border border-border">
              <div className="text-center py-16">
                <div className="flex justify-center mb-5">
                  <svg className="w-10 h-10 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t('emptyNetwork.title')}
                </h3>
                <p className="text-sm text-muted mb-8 max-w-sm mx-auto">
                  {t('emptyNetwork.description')}
                </p>
                <Link
                  href="/people/new"
                  className="inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-dark text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                  {t('emptyNetwork.action')}
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
