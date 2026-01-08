import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import DateFormatSelector from '@/components/DateFormatSelector';
import { prisma } from '@/lib/prisma';

export default async function AppearanceSettingsPage() {
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
    <div className="space-y-6">
      {/* Theme Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          Theme
        </h2>
        <p className="text-muted mb-6">
          Choose how NameTag looks to you.
        </p>
        <ThemeToggle userId={session.user.id} currentTheme={currentTheme} />
      </div>

      {/* Date Format Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          Date Format
        </h2>
        <p className="text-muted mb-6">
          Choose how dates are displayed throughout the app.
        </p>
        <DateFormatSelector userId={session.user.id} currentFormat={currentDateFormat} />
      </div>
    </div>
  );
}
