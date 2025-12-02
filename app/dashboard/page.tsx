import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/dashboard"
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome to Name Tag, {session.user.name || 'User'}!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your personal relationships manager dashboard. More features coming soon!
            </p>

            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/people"
                className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  People
                </h3>
                <p className="text-blue-700 dark:text-blue-300 text-sm">
                  Manage the people in your network
                </p>
              </Link>

              <Link
                href="/groups"
                className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  Groups
                </h3>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Organize people into categories
                </p>
              </Link>

              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 opacity-50 cursor-not-allowed">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  Network
                </h3>
                <p className="text-purple-700 dark:text-purple-300 text-sm">
                  Visualize your relationship network (coming soon)
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
