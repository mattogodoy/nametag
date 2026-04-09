import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { isServiceAccountConfigured } from '@/lib/google/auth';
import { getTranslations } from 'next-intl/server';
import GoogleIntegrationCard from '@/components/google/GoogleIntegrationCard';
import GoogleConnectForm from '@/components/google/GoogleConnectForm';

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
      lastGmailSyncAt: true,
      lastError: true,
      syncInProgress: true,
    },
  });

  const oauthConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const serviceAccountAvailable = isServiceAccountConfigured();

  const integrationStatus = integration
    ? {
        authMode: integration.authMode,
        gmailSyncEnabled: integration.gmailSyncEnabled,
        driveSyncEnabled: integration.driveSyncEnabled,
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
        <GoogleIntegrationCard integration={integrationStatus} />
      ) : (
        <GoogleConnectForm
          oauthConfigured={oauthConfigured}
          serviceAccountAvailable={serviceAccountAvailable}
        />
      )}
    </div>
  );
}
