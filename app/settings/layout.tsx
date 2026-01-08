import { auth } from '@/lib/auth';
import { isSaasMode as getIsSaasMode } from '@/lib/features';
import { redirect } from 'next/navigation';
import Navigation from '@/components/Navigation';
import SettingsNav from '@/components/SettingsNav';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const isSaasMode = getIsSaasMode();

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        userEmail={session.user.email || undefined}
        userName={session.user.name}
        userNickname={session.user.nickname}
        currentPath="/settings"
      />

      <main className="max-w-6xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-foreground mb-6">
            Settings
          </h1>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Settings Navigation - responsive (dropdown on mobile, sidebar on desktop) */}
            <aside className="w-full md:w-64 flex-shrink-0">
              <SettingsNav isSaasMode={isSaasMode} />
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
