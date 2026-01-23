import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import CardDavConnectionForm from '@/components/CardDavConnectionForm';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function CardDavSettingsPage() {
  const session = await auth();
  const t = await getTranslations('settings.carddav');

  if (!session?.user) {
    redirect('/login');
  }

  // Fetch existing CardDAV connection if it exists
  const connection = await prisma.cardDavConnection.findUnique({
    where: {
      userId: session.user.id,
    },
  });

  // Get pending imports count
  const pendingImportsCount = connection
    ? await prisma.cardDavPendingImport.count({
        where: {
          connectionId: connection.id,
        },
      })
    : 0;

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-foreground">
          {t('title')}
        </h2>
        {connection && pendingImportsCount > 0 && (
          <Link
            href="/carddav/import"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {t('viewPendingImports')} ({pendingImportsCount})
          </Link>
        )}
      </div>
      <p className="text-muted mb-6">
        {t('pageDescription')}
      </p>

      <CardDavConnectionForm
        userId={session.user.id}
        existingConnection={connection}
      />
    </div>
  );
}
