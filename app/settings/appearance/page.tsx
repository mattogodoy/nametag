import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import DateFormatSelector from '@/components/DateFormatSelector';
import NameOrderSelector from '@/components/NameOrderSelector';
import NameDisplayFormatSelector from '@/components/NameDisplayFormatSelector';
import LanguageSelector from '@/components/LanguageSelector';
import GraphDisplaySelector from '@/components/GraphDisplaySelector';
import InstallAppSettings from '@/components/InstallAppSettings';
import { getUserLocale, isSupportedLocale, type SupportedLocale } from '@/lib/locale';
import { getTranslations } from 'next-intl/server';
import { getUserDisplayPreferences } from '@/lib/user-preferences';

export default async function AppearanceSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Get translations
  const t = await getTranslations('settings.appearance');

  const {
    theme: currentTheme,
    dateFormat: currentDateFormat,
    language,
    nameOrder: currentNameOrder,
    nameDisplayFormat: currentNameDisplayFormat,
    graphMode: currentGraphMode,
  } = await getUserDisplayPreferences(session.user.id);

  // The stored language may predate a locale being supported, so fall back to
  // the request's detected locale rather than rendering an unsupported code.
  const currentLanguage: SupportedLocale = isSupportedLocale(language)
    ? language
    : await getUserLocale(session.user.id);

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
        <DateFormatSelector userId={session.user.id} currentFormat={currentDateFormat} />
      </div>

      {/* Name Display Order Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('nameOrderTitle')}
        </h2>
        <p className="text-muted mb-6">
          {t('nameOrderDescription')}
        </p>
        <NameOrderSelector currentOrder={currentNameOrder} />
      </div>

      {/* Name Display Format Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('nameDisplayFormatTitle')}
        </h2>
        <p className="text-muted mb-6">
          {t('nameDisplayFormatDescription')}
        </p>
        <NameDisplayFormatSelector currentFormat={currentNameDisplayFormat} />
      </div>

      {/* Network Graph Display Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('graphModeTitle')}
        </h2>
        <p className="text-muted mb-6">
          {t('graphModeDescription')}
        </p>
        <GraphDisplaySelector currentMode={currentGraphMode} />
      </div>

      {/* Install App Settings */}
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('installTitle')}
        </h2>
        <p className="text-muted mb-6">
          {t('installDescription')}
        </p>
        <InstallAppSettings />
      </div>
    </div>
  );
}
