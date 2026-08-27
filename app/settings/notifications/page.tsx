import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { isEmailConfigured } from '@/lib/email';
import { isPushConfigured } from '@/lib/notifications/vapid';
import ReminderLeadTimeSelector from '@/components/ReminderLeadTimeSelector';
import WeeklyDigestSettings from '@/components/WeeklyDigestSettings';
import NotificationChannelsCard from '@/components/NotificationChannelsCard';
import NotificationEndpointsCard from '@/components/NotificationEndpointsCard';
import { MAX_ENDPOINTS_PER_USER } from '@/lib/notifications/endpoint-health';

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
      emailRemindersEnabled: true,
    },
  });

  const devices = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
    // NEVER select `endpoint` here. The subscribe route upserts on endpoint and
    // reassigns userId, so anyone who learns a victim's endpoint string can move
    // that row to their own account and silently kill the victim's push. Nothing
    // in the app exposes it today; keep it that way.
    // createdAt is ordered on but not selected: nothing renders it.
    select: { id: true, userAgent: true },
    orderBy: { createdAt: 'asc' },
  });

  // A self-hoster without SMTP should not be able to switch on an email that
  // will never arrive.
  const emailAvailable = isEmailConfigured();

  const endpoints = await prisma.notificationEndpoint.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      label: true,
      url: true,
      enabled: true,
      lastFailureCode: true,
      autoDisabledAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-6">
      <NotificationChannelsCard
        emailEnabled={user?.emailRemindersEnabled ?? true}
        emailAvailable={emailAvailable}
        pushAvailable={isPushConfigured()}
        devices={devices.map((device) => ({ id: device.id, userAgent: device.userAgent }))}
      />

      <NotificationEndpointsCard
        endpoints={endpoints.map((endpoint) => ({
          ...endpoint,
          autoDisabledAt: endpoint.autoDisabledAt?.toISOString() ?? null,
        }))}
        canAdd={endpoints.length < MAX_ENDPOINTS_PER_USER}
      />

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
