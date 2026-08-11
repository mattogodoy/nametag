import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured } from '@/lib/email';
import ReminderLeadTimeSelector from '@/components/ReminderLeadTimeSelector';
import WeeklyDigestSettings from '@/components/WeeklyDigestSettings';

export default async function NotificationSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('settings.notifications');

  // select is an allowlist: only these three columns can ever reach this
  // page, so the password hash and other sensitive columns never enter
  // process memory for this request in the first place.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      defaultReminderLeadDays: true,
      weeklyDigestEnabled: true,
      weeklyDigestWeekday: true,
    },
  });

  // A self-hoster without SMTP should not be able to switch on an email that
  // will never arrive.
  const emailAvailable = isEmailConfigured();

  return (
    <div className="space-y-6">
      {!emailAvailable && (
        <div className="bg-surface shadow rounded-lg p-6">
          <p className="text-sm text-muted">{t('emailNotConfigured')}</p>
        </div>
      )}

      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">{t('leadTimeTitle')}</h2>
        <p className="text-muted mb-6">{t('leadTimeDescription')}</p>
        <ReminderLeadTimeSelector
          currentLeadDays={user?.defaultReminderLeadDays ?? 0}
          disabled={!emailAvailable}
        />
      </div>

      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">{t('digestTitle')}</h2>
        <p className="text-muted mb-6">{t('digestDescription')}</p>
        <WeeklyDigestSettings
          currentEnabled={user?.weeklyDigestEnabled ?? false}
          currentWeekday={user?.weeklyDigestWeekday ?? 1}
          disabled={!emailAvailable}
        />
      </div>
    </div>
  );
}
