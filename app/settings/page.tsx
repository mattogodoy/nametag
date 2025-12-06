import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import ThemeToggle from '@/components/ThemeToggle';
import DateFormatSelector from '@/components/DateFormatSelector';
import ProfileForm from '@/components/ProfileForm';
import PasswordChangeForm from '@/components/PasswordChangeForm';
import AccountManagement from '@/components/AccountManagement';
import { prisma } from '@/lib/prisma';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true, dateFormat: true },
  });

  const currentTheme = user?.theme || 'DARK';
  const currentDateFormat = user?.dateFormat || 'MDY';

  return (
    <div className="min-h-screen bg-base-200">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/settings"
      />

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold mb-6">
            Settings
          </h1>

          {/* Profile Settings */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h2 className="card-title">
                <span className="icon-[tabler--user] size-6" />
                Profile
              </h2>
              <ProfileForm
                userId={session.user.id}
                currentName={session.user.name || ''}
                currentSurname={session.user.surname || ''}
                currentNickname={session.user.nickname || ''}
                currentEmail={session.user.email || ''}
              />
            </div>
          </div>

          {/* Theme Settings */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h2 className="card-title">
                <span className="icon-[tabler--palette] size-6" />
                Appearance
              </h2>
              <ThemeToggle userId={session.user.id} currentTheme={currentTheme} />
            </div>
          </div>

          {/* Date Format Settings */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h2 className="card-title">
                <span className="icon-[tabler--calendar] size-6" />
                Date Format
              </h2>
              <DateFormatSelector userId={session.user.id} currentFormat={currentDateFormat} />
            </div>
          </div>

          {/* Password Settings */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h2 className="card-title">
                <span className="icon-[tabler--lock] size-6" />
                Password
              </h2>
              <PasswordChangeForm userId={session.user.id} />
            </div>
          </div>

          {/* Account Management */}
          <div className="card bg-base-100 shadow-lg mb-6">
            <div className="card-body">
              <h2 className="card-title">
                <span className="icon-[tabler--settings] size-6" />
                Account Management
              </h2>
              <AccountManagement />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
