import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeletePersonButton from '@/components/DeletePersonButton';
import RelationshipManager from '@/components/RelationshipManager';
import UnifiedNetworkGraph from '@/components/UnifiedNetworkGraph';
import Navigation from '@/components/Navigation';
import { formatDate } from '@/lib/date-format';
import { formatFullName } from '@/lib/nameUtils';

function getReminderDescription(date: {
  reminderEnabled: boolean;
  reminderType: string | null;
  reminderInterval: number | null;
  reminderIntervalUnit: string | null;
}): string | null {
  if (!date.reminderEnabled) return null;
  if (date.reminderType === 'ONCE') {
    return 'Remind once';
  }
  if (date.reminderType === 'RECURRING' && date.reminderInterval && date.reminderIntervalUnit) {
    const unit = date.reminderIntervalUnit.toLowerCase();
    return `Remind every ${date.reminderInterval} ${date.reminderInterval === 1 ? unit.slice(0, -1) : unit}`;
  }
  return null;
}

function getContactReminderDescription(person: {
  contactReminderEnabled: boolean;
  contactReminderInterval: number | null;
  contactReminderIntervalUnit: string | null;
}): string | null {
  if (!person.contactReminderEnabled) return null;
  if (person.contactReminderInterval && person.contactReminderIntervalUnit) {
    const unit = person.contactReminderIntervalUnit.toLowerCase();
    return `Remind after ${person.contactReminderInterval} ${person.contactReminderInterval === 1 ? unit.slice(0, -1) : unit}`;
  }
  return null;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  } else if (diffDays === 1) {
    return '1 day ago';
  } else if (diffDays < 30) {
    return `${diffDays} days ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  }
}

export default async function PersonDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true },
  });
  const dateFormat = user?.dateFormat || 'MDY';

  const [person, allPeople, relationshipTypes] = await Promise.all([
    prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        relationshipToUser: true,
        groups: {
          include: {
            group: true,
          },
        },
        relationshipsFrom: {
          include: {
            relatedPerson: true,
            relationshipType: true,
          },
        },
        importantDates: {
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
        OR: [
          { userId: null },
          { userId: session.user.id },
        ],
      },
      select: {
        id: true,
        name: true,
        label: true,
        color: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    }),
  ]);

  if (!person) {
    notFound();
  }

  const relatedPersonIds = new Set(
    person.relationshipsFrom.map((r) => r.relatedPersonId)
  );
  const availablePeople = allPeople.filter(
    (p) => !relatedPersonIds.has(p.id)
  );

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/people"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link href="/people" className="link link-primary text-sm flex items-center gap-1">
              <span className="icon-[tabler--arrow-left] size-4" />
              Back to People
            </Link>
          </div>

          <div className="card bg-base-100 shadow-lg overflow-visible">
            <div className="card-body border-b border-base-content/10">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold break-words">
                    {formatFullName(person)}
                  </h1>
                  {person.groups.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {person.groups.map((pg) => (
                        <span
                          key={pg.groupId}
                          className="badge"
                          style={{
                            backgroundColor: pg.group.color
                              ? `${pg.group.color}20`
                              : undefined,
                            color: pg.group.color || undefined,
                          }}
                        >
                          {pg.group.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-3 w-full sm:w-auto">
                  <Link
                    href={`/people/${person.id}/edit`}
                    className="btn btn-primary flex-1 sm:flex-none"
                  >
                    <span className="icon-[tabler--edit] size-4" />
                    Edit
                  </Link>
                  <DeletePersonButton personId={person.id} personName={formatFullName(person)} />
                </div>
              </div>
            </div>

            <div className="card-body space-y-6">
              {/* Details Section */}
              {(person.lastContact || person.notes) && (
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-lg">
                      <span className="icon-[tabler--info-circle] size-5" />
                      Details
                    </h3>
                    <div className="space-y-4">
                      {person.lastContact && (
                        <div>
                          <h4 className="text-sm font-medium text-base-content/60 mb-1">
                            Last Contact
                          </h4>
                          <p>
                            {formatDate(new Date(person.lastContact), dateFormat)}{' '}
                            <span className="text-sm text-base-content/60">
                              ({getRelativeTime(new Date(person.lastContact))})
                            </span>
                          </p>
                          {getContactReminderDescription(person) && (
                            <div className="text-xs text-primary mt-1 flex items-center gap-1">
                              <span className="icon-[tabler--bell] size-3" />
                              {getContactReminderDescription(person)}
                            </div>
                          )}
                        </div>
                      )}

                      {person.notes && (
                        <div>
                          <h4 className="text-sm font-medium text-base-content/60 mb-1">
                            Notes
                          </h4>
                          <p className="whitespace-pre-wrap">
                            {person.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Relationship Network Section */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg">
                    <span className="icon-[tabler--network] size-5" />
                    Relationship Network
                  </h3>
                  <UnifiedNetworkGraph
                    apiEndpoint={`/api/people/${person.id}/graph`}
                    centerNodeId={person.id}
                    linkDistance={100}
                    chargeStrength={-300}
                    animateNewNodes={true}
                    refreshKey={person.relationshipsFrom.length}
                  />
                  <p className="text-xs text-base-content/60 mt-2">
                    Click nodes to navigate | Drag to reposition | Scroll to zoom
                  </p>
                </div>
              </div>

              {/* Relationships Section */}
              <div className="card bg-base-200">
                <div className="card-body">
                  <h3 className="card-title text-lg">
                    <span className="icon-[tabler--heart-handshake] size-5" />
                    Relationships
                  </h3>

                  {/* Relationship to user */}
                  {person.relationshipToUser && (
                    <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">You</span>
                          <span className="text-base-content/40">•</span>
                          <span
                            className="badge badge-sm"
                            style={{
                              backgroundColor: person.relationshipToUser.color
                                ? `${person.relationshipToUser.color}20`
                                : undefined,
                              color: person.relationshipToUser.color || undefined,
                            }}
                          >
                            {person.relationshipToUser.label}
                          </span>
                        </div>
                        <Link
                          href={`/people/${person.id}/edit`}
                          className="btn btn-ghost btn-square btn-sm"
                          title="Edit"
                        >
                          <span className="icon-[tabler--edit] size-4" />
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Relationships to other people */}
                  <RelationshipManager
                    personId={person.id}
                    personName={formatFullName(person)}
                    relationships={person.relationshipsFrom}
                    availablePeople={availablePeople}
                    relationshipTypes={relationshipTypes}
                  />
                </div>
              </div>

              {/* Important Dates Section */}
              {person.importantDates && person.importantDates.length > 0 && (
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h3 className="card-title text-lg">
                      <span className="icon-[tabler--calendar-event] size-5" />
                      Important Dates
                    </h3>
                    <div className="space-y-2">
                      {person.importantDates.map((date) => {
                        const reminderDesc = getReminderDescription(date);
                        return (
                          <div
                            key={date.id}
                            className="flex items-center justify-between p-3 bg-base-300 rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-sm">
                                {date.title}
                              </div>
                              <div className="text-xs text-base-content/60">
                                {formatDate(new Date(date.date), dateFormat)}
                              </div>
                              {reminderDesc && (
                                <div className="text-xs text-primary mt-1 flex items-center gap-1">
                                  <span className="icon-[tabler--bell] size-3" />
                                  {reminderDesc}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
