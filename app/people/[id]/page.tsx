import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import DeletePersonButton from '@/components/DeletePersonButton';
import RelationshipManager from '@/components/RelationshipManager';
import NetworkGraph from '@/components/NetworkGraph';
import Navigation from '@/components/Navigation';

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

  const [person, allPeople, relationshipTypes] = await Promise.all([
    prisma.person.findUnique({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
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
      },
    }),
    prisma.person.findMany({
      where: {
        userId: session.user.id,
        NOT: { id },
      },
      select: {
        id: true,
        fullName: true,
      },
      orderBy: {
        fullName: 'asc',
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

  // Filter out people who already have a relationship
  const relatedPersonIds = new Set(
    person.relationshipsFrom.map((r) => r.relatedPersonId)
  );
  const availablePeople = allPeople.filter(
    (p) => !relatedPersonIds.has(p.id)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/people"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href="/people"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to People
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {person.fullName}
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
              <div className="flex space-x-3">
                <Link
                  href={`/people/${person.id}/edit`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Edit
                </Link>
                <DeletePersonButton personId={person.id} personName={person.fullName} />
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {person.birthDate && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Birth Date
                    </h3>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(person.birthDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {person.phone && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Phone
                    </h3>
                    <p className="text-gray-900 dark:text-white">{person.phone}</p>
                  </div>
                )}

                {person.address && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Address
                    </h3>
                    <p className="text-gray-900 dark:text-white">{person.address}</p>
                  </div>
                )}

                {person.lastContact && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Last Contact
                    </h3>
                    <p className="text-gray-900 dark:text-white">
                      {new Date(person.lastContact).toLocaleDateString()}{' '}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({getRelativeTime(new Date(person.lastContact))})
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {person.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Notes
                  </h3>
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {person.notes}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Relationship Network
                </h3>
                <NetworkGraph
                  personId={person.id}
                  refreshKey={person.relationshipsFrom.length}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Click nodes to navigate • Drag to reposition • Scroll to zoom
                </p>
              </div>

              <div>
                <RelationshipManager
                  personId={person.id}
                  relationships={person.relationshipsFrom}
                  availablePeople={availablePeople}
                  relationshipTypes={relationshipTypes}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
