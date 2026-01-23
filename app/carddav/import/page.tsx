import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import ImportContactsList from '@/components/ImportContactsList';

export default async function ImportPage() {
  const session = await auth();
  const t = await getTranslations('settings.carddav.import');

  if (!session?.user) {
    redirect('/login');
  }

  // Get CardDAV connection
  const connection = await prisma.cardDavConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    redirect('/settings/carddav');
  }

  // Get pending imports
  const pendingImports = await prisma.cardDavPendingImport.findMany({
    where: {
      connectionId: connection.id,
    },
    orderBy: {
      discoveredAt: 'desc',
    },
  });

  // Get user's groups for assignment
  const groups = await prisma.group.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-surface shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          {t('title')}
        </h1>

        {pendingImports.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📥</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('noPending')}
            </h2>
            <p className="text-muted">
              {t('noPendingDescription')}
            </p>
          </div>
        ) : (
          <>
            <p className="text-muted mb-6">
              {t('description', { count: pendingImports.length })}
            </p>

            <ImportContactsList
              pendingImports={pendingImports}
              groups={groups}
            />
          </>
        )}
      </div>
    </div>
  );
}
