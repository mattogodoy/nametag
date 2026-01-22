import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import DateFormatSelector from '@/components/DateFormatSelector';
import LanguageSelector from '@/components/LanguageSelector';
import { prisma } from '@/lib/prisma';
import { getUserLocale } from '@/lib/locale';
import { type SupportedLocale } from '@/lib/locale-config';
import { getTranslations } from 'next-intl/server';

export default async function AppearanceSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get translations
  const t = await getTranslations('settings.appearance');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { theme: true, dateFormat: true, language: true },
  });

  const currentTheme = user?.theme || 'DARK';
  const currentDateFormat = user?.dateFormat || 'MDY';
  const currentLanguage = (user?.language as SupportedLocale) || (await getUserLocale(session.user.id));

  return (
    <div className="space-y-6">
      {/* Theme Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('themeTitle')}
        </h2>
        <p className="text-muted mb-6">
          {t('themeDescription')}
        </p>
        <ThemeToggle userId={session.user.id} currentTheme={currentTheme} />
      </div>

      {/* Language Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('language.title')}
        </h2>
        <LanguageSelector currentLanguage={currentLanguage} />
      </div>

      {/* Date Format Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('dateFormatTitle')}
        </h2>
        <p className="text-muted mb-6">
          {t('dateFormatDescription')}
        </p>
        <DateFormatSelector userId={session.user.id} currentFormat={currentDateFormat} />
      </div>
    </div>
  );
}
