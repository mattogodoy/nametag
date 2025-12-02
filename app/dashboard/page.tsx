import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { prisma } from '@/lib/prisma';
import DashboardNetworkGraph from '@/components/DashboardNetworkGraph';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch statistics
  const [peopleCount, groupsCount, relationshipsCount, recentPeople] = await Promise.all([
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
      where: { userId: session.user.id },
      orderBy: { lastContact: 'desc' },
      take: 5,
      select: {
        id: true,
        fullName: true,
        lastContact: true,
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
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

            <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
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
            </div>
          </div>

          {/* Network Graph */}
          {peopleCount > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Your Network
              </h2>
              <DashboardNetworkGraph />
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
                      {person.fullName}
                    </span>
                    {person.lastContact && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(person.lastContact).toLocaleDateString()}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/people/new"
                className="flex items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <span className="text-2xl mr-3">➕</span>
                <span className="text-blue-900 dark:text-blue-100 font-medium">
                  Add Person
                </span>
              </Link>
              <Link
                href="/groups/new"
                className="flex items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
              >
                <span className="text-2xl mr-3">📁</span>
                <span className="text-green-900 dark:text-green-100 font-medium">
                  Create Group
                </span>
              </Link>
              <Link
                href="/relationship-types/new"
                className="flex items-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
              >
                <span className="text-2xl mr-3">🔗</span>
                <span className="text-purple-900 dark:text-purple-100 font-medium">
                  New Relationship Type
                </span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
