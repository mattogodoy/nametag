import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ThemeToggle from '@/components/ThemeToggle';
import ProfileForm from '@/components/ProfileForm';
import PasswordChangeForm from '@/components/PasswordChangeForm';
import { prisma } from '@/lib/prisma';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch user's current theme
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true },
  });

  const currentTheme = user?.theme || 'LIGHT';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        currentPath="/settings"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Settings
          </h1>

          {/* Theme Settings */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Appearance
            </h2>
            <ThemeToggle userId={session.user.id} currentTheme={currentTheme} />
          </div>

          {/* Profile Settings */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Profile
            </h2>
            <ProfileForm
              userId={session.user.id}
              currentName={session.user.name || ''}
              currentEmail={session.user.email || ''}
            />
          </div>

          {/* Password Settings */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Password
            </h2>
            <PasswordChangeForm userId={session.user.id} />
          </div>
        </div>
      </main>
    </div>
  );
}
