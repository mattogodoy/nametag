import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { prisma } from '@/lib/prisma';
import UnifiedNetworkGraph from '@/components/UnifiedNetworkGraph';
import { formatDate } from '@/lib/date-format';
import { formatFullName } from '@/lib/nameUtils';

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

  // Fetch statistics and groups
  const [peopleCount, groupsCount, relationshipsCount, recentPeople, groups] = await Promise.all([
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
    prisma.person.findMany({
      where: {
        userId: session.user.id,
        lastContact: { not: null },
      },
      orderBy: { lastContact: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        surname: true,
        nickname: true,
        lastContact: true,
      },
    }),
    prisma.group.findMany({
      where: { userId: session.user.id },
      orderBy: { name: 'asc' },
    }),
  ]);

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
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {session.user.name || 'User'}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Here's an overview of your network
            </p>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
            <Link
              href="/people"
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-4xl">👥</div>
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
                    <div className="text-4xl">📁</div>
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
                    <div className="text-4xl">🔗</div>
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
          {peopleCount > 0 && (
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
          )}

          {/* Recent Contacts */}
          {recentPeople.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Recent Contacts
              </h2>
              <div className="space-y-3">
                {recentPeople.map((person) => (
                  <Link
                    key={person.id}
                    href={`/people/${person.id}`}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <span className="text-gray-900 dark:text-white font-medium">
                      {formatFullName(person)}
                    </span>
                    {person.lastContact && (
                      <span
                        className="text-sm text-gray-500 dark:text-gray-400 cursor-help"
                        title={formatDate(new Date(person.lastContact), dateFormat)}
                      >
                        {getRelativeTime(new Date(person.lastContact))}
                      </span>
                    )}
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
