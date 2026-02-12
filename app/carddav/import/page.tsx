import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import ImportContactsList from '@/components/ImportContactsList';
import Navigation from '@/components/Navigation';

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const session = await auth();
  const t = await getTranslations('settings.carddav.import');
  const params = await searchParams;

  if (!session?.user) {
    redirect('/login');
  }

  // Get user for navigation
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      nickname: true,
    },
  });

  const isFileImport = params.source === 'file';
  const FILE_IMPORT_CONNECTION_ID = '00000000-0000-0000-0000-000000000001';

  // Get CardDAV connection or file import connection
  const connection = isFileImport
    ? await prisma.cardDavConnection.findUnique({
        where: { id: FILE_IMPORT_CONNECTION_ID },
      })
    : await prisma.cardDavConnection.findUnique({
        where: { userId: session.user.id },
      });

  if (!connection) {
    // For file imports, if no pending imports exist, redirect to account
    // For CardDAV, redirect to setup
    redirect(isFileImport ? '/settings/account' : '/settings/carddav');
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
    <>
      <Navigation
        userEmail={user?.email}
        userName={user?.name}
        userNickname={user?.nickname}
        currentPath="/carddav/import"
      />

      <div className="container mx-auto px-4 py-8">
        <div className="bg-surface shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-foreground mb-4">
            {isFileImport ? t('titleFile') : t('title')}
          </h1>

          {pendingImports.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📥</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {isFileImport ? t('noPendingFile') : t('noPending')}
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
                isFileImport={isFileImport}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
