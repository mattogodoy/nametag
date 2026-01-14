import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeletePersonButton from '@/components/DeletePersonButton';
import DeleteUserRelationshipButton from '@/components/DeleteUserRelationshipButton';
import RelationshipManager from '@/components/RelationshipManager';
import UnifiedNetworkGraph from '@/components/UnifiedNetworkGraph';
import Navigation from '@/components/Navigation';
import { formatDate } from '@/lib/date-format';
import { formatFullName } from '@/lib/nameUtils';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { getTranslations } from 'next-intl/server';

// Type for translation function
type TranslationFn = (key: string, values?: Record<string, string | number | Date>) => string;

function getYearsAgo(date: Date, t: TranslationFn): string | null {
  const now = new Date();
  if (date >= now) return null; // Future date, don't show anything

  const years = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  const dayDiff = now.getDate() - date.getDate();

  // Adjust if the anniversary hasn't occurred yet this year
  const adjustedYears = (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) ? years - 1 : years;

  if (adjustedYears < 1) return null;
  return adjustedYears === 1 ? t('oneYearAgo') : t('yearsAgo', { years: adjustedYears });
}

function getReminderDescription(
  date: {
    reminderEnabled: boolean;
    reminderType: string | null;
    reminderInterval: number | null;
    reminderIntervalUnit: string | null;
  },
  t: TranslationFn
): string | null {
  if (!date.reminderEnabled) return null;
  if (date.reminderType === 'ONCE') {
    return t('remindOnce');
  }
  if (date.reminderType === 'RECURRING' && date.reminderInterval && date.reminderIntervalUnit) {
    const unit = date.reminderIntervalUnit.toLowerCase();
    const translatedUnit = date.reminderInterval === 1 ? t(unit.slice(0, -1)) : t(unit);
    return t('remindEvery', { interval: date.reminderInterval, unit: translatedUnit });
  }
  return null;
}

function getContactReminderDescription(
  person: {
    contactReminderEnabled: boolean;
    contactReminderInterval: number | null;
    contactReminderIntervalUnit: string | null;
  },
  t: TranslationFn
): string | null {
  if (!person.contactReminderEnabled) return null;
  if (person.contactReminderInterval && person.contactReminderIntervalUnit) {
    const unit = person.contactReminderIntervalUnit.toLowerCase();
    const translatedUnit = person.contactReminderInterval === 1 ? t(unit.slice(0, -1)) : t(unit);
    return t('remindAfter', { interval: person.contactReminderInterval, unit: translatedUnit });
  }
  return null;
}

function getRelativeTime(date: Date, t: (key: string, values?: Record<string, string | number>) => string): string {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return t('today');
  } else if (diffDays === 1) {
    return t('oneDayAgo');
  } else if (diffDays < 30) {
    return t('daysAgo', { days: diffDays });
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? t('oneMonthAgo') : t('monthsAgo', { months });
  } else {
    const years = Math.floor(diffDays / 365);
    return years === 1 ? t('oneYearAgo') : t('yearsAgo', { years });
  }
}

export default async function PersonDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('people');

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  // Fetch user's date format preference and name
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      dateFormat: true,
      name: true,
      surname: true,
      nickname: true,
    },
  });
  const dateFormat = user?.dateFormat || 'MDY';

  const [person, allPeople, relationshipTypes] = await Promise.all([
    prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        relationshipToUser: {
          where: {
            deletedAt: null,
          },
        },
        groups: {
          where: {
            group: {
              deletedAt: null,
            },
          },
          include: {
            group: true,
          },
        },
        relationshipsTo: {
          where: {
            deletedAt: null,
            person: {
              deletedAt: null,
            },
          },
          include: {
            person: true,
            relationshipType: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
        importantDates: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
        NOT: { id },
      },
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.relationshipType.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        label: true,
        color: true,
        inverseId: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!person) {
    notFound();
  }

  // Filter out people who already have a relationship
  const relatedPersonIds = new Set(
    person.relationshipsTo.map((r) => r.personId)
  );
  const availablePeople = allPeople.filter(
    (p) => !relatedPersonIds.has(p.id)
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/people"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/people"
              className="text-primary hover:underline text-sm"
            >
              {t('backToPeople')}
            </Link>
          </div>

          <div className="bg-surface shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                  {formatFullName(person)}
                </h1>
                {person.groups.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {person.groups.map((pg) => (
                      <span
                        key={pg.groupId}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: pg.group.color
                            ? `${pg.group.color}20`
                            : '#E5E7EB',
                          color: pg.group.color || '#374151',
                        }}
                      >
                        {pg.group.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-shrink-0 space-x-3 w-full sm:w-auto">
                <Link
                  href={`/people/${person.id}/edit`}
                  className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors shadow-lg hover:shadow-primary/50 text-center"
                >
                  {t('edit')}
                </Link>
                <DeletePersonButton personId={person.id} personName={formatFullName(person)} />
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Details Section */}
              {(person.lastContact || person.notes) && (
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('details')}
                  </h3>
                  <div className="space-y-4">
                    {person.lastContact && (
                      <div>
                        <h4 className="text-sm font-medium text-muted mb-1">
                          {t('lastTimeTalked')}
                        </h4>
                        <p className="text-foreground">
                          {formatDate(new Date(person.lastContact), dateFormat)}{' '}
                          <span className="text-sm text-muted">
                            ({getRelativeTime(new Date(person.lastContact), t)})
                          </span>
                        </p>
                        {getContactReminderDescription(person, t) && (
                          <div className="text-xs text-primary mt-1 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            {getContactReminderDescription(person, t)}
                          </div>
                        )}
                      </div>
                    )}

                    {person.notes && (
                      <div>
                        <h4 className="text-sm font-medium text-muted mb-1">
                          {t('notes')}
                        </h4>
                        <MarkdownRenderer content={person.notes} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Important Dates Section */}
              {person.importantDates && person.importantDates.length > 0 && (
                <div className="border border-border rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    {t('importantDates')}
                  </h3>
                  <div className="space-y-2">
                    {person.importantDates.map((date) => {
                      const reminderDesc = getReminderDescription(date, t);
                      const dateObj = new Date(date.date);
                      const yearsAgo = getYearsAgo(dateObj, t);
                      return (
                        <div
                          key={date.id}
                          className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-foreground text-sm">
                              {date.title}
                            </div>
                            <div className="text-xs text-muted">
                              {formatDate(dateObj, dateFormat)}
                              {yearsAgo && <span className="ml-1">({yearsAgo})</span>}
                            </div>
                            {reminderDesc && (
                              <div className="text-xs text-primary mt-1 flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                {reminderDesc}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Relationship Network Section */}
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {t('relationshipNetwork')}
                </h3>
                <UnifiedNetworkGraph
                  apiEndpoint={`/api/people/${person.id}/graph`}
                  centerNodeId={person.id}
                  linkDistance={100}
                  chargeStrength={-300}
                  animateNewNodes={true}
                  refreshKey={person.relationshipsTo.length + (person.relationshipToUserId ? 1000 : 0)}
                />
                <p className="text-xs text-muted mt-2">
                  {t('graphHelp')}
                </p>
              </div>

              {/* Relationships Section */}
              <div className="border border-border rounded-lg p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {t('relationships')}
                </h3>

                {/* Relationship to user */}
                {person.relationshipToUser && (
                  <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {t('you')}
                        </span>
                        <span className="text-muted">•</span>
                        <span
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: person.relationshipToUser.color
                              ? `${person.relationshipToUser.color}20`
                              : '#E5E7EB',
                            color: person.relationshipToUser.color || '#374151',
                          }}
                        >
                          {person.relationshipToUser.label}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <Link
                          href={`/people/${person.id}/edit`}
                          className="text-primary hover:text-primary-dark transition-colors"
                          title={t('edit')}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                        <DeleteUserRelationshipButton
                          personId={person.id}
                          personName={formatFullName(person)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Relationships to other people */}
                <RelationshipManager
                  personId={person.id}
                  personName={formatFullName(person)}
                  relationships={person.relationshipsTo}
                  availablePeople={availablePeople}
                  relationshipTypes={relationshipTypes}
                  currentUser={{
                    id: session.user.id,
                    name: user?.name || '',
                    surname: user?.surname || null,
                    nickname: user?.nickname || null,
                  }}
                  hasUserRelationship={!!person.relationshipToUserId}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
