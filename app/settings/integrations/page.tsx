import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getTranslations } from 'next-intl/server';
import GoogleIntegrationCard from '@/components/google/GoogleIntegrationCard';
import GoogleConnectForm from '@/components/google/GoogleConnectForm';
import SyncHistory from '@/components/google/SyncHistory';

export default async function IntegrationsSettingsPage() {
  const session = await auth();
  const t = await getTranslations('settings.integrations');

  if (!session?.user) {
    redirect('/login');
  }

  const integration = await prisma.googleIntegration.findUnique({
    where: { userId: session.user.id },
    select: {
      authMode: true,
      gmailSyncEnabled: true,
      driveSyncEnabled: true,
      driveFolderName: true,
      calendarSyncEnabled: true,
      birthdayCalendarId: true,
      ocrEnabled: true,
      autoSyncInterval: true,
      lastGmailSyncAt: true,
      lastError: true,
      syncInProgress: true,
    },
  });

  // OAuth is available if Google client credentials are configured (regardless of SaaS mode)
  const oauthConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  // Service account form is always shown - users can paste their key even without env vars
  const serviceAccountAvailable = true;

  const integrationStatus = integration
    ? {
        authMode: integration.authMode,
        gmailSyncEnabled: integration.gmailSyncEnabled,
        driveSyncEnabled: integration.driveSyncEnabled,
        driveFolderName: integration.driveFolderName,
        calendarSyncEnabled: integration.calendarSyncEnabled,
        birthdayCalendarId: integration.birthdayCalendarId,
        ocrEnabled: integration.ocrEnabled,
        autoSyncInterval: integration.autoSyncInterval,
        lastGmailSyncAt: integration.lastGmailSyncAt?.toISOString() ?? null,
        lastError: integration.lastError,
        syncInProgress: integration.syncInProgress,
      }
    : null;

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">
        {t('title')}
      </h2>
      <p className="text-muted mb-6">
        {t('description')}
      </p>

      {integration ? (
        <>
          <GoogleIntegrationCard integration={integrationStatus} />
          <div className="mt-6">
            <SyncHistory />
          </div>
        </>
      ) : (
        <GoogleConnectForm
          oauthConfigured={oauthConfigured}
          serviceAccountAvailable={serviceAccountAvailable}
        />
      )}
    </div>
  );
}
