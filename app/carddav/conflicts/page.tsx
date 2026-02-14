import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import ConflictList from '@/components/ConflictList';

export default async function ConflictsPage() {
  const session = await auth();
  const t = await getTranslations('settings.carddav.conflicts');

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

  // Get all mappings for this connection to find conflicts
  const mappings = await prisma.cardDavMapping.findMany({
    where: {
      connectionId: connection.id,
    },
    select: {
      id: true,
    },
  });

  const mappingIds = mappings.map(m => m.id);

  // Get all unresolved conflicts for these mappings
  const conflicts = await prisma.cardDavConflict.findMany({
    where: {
      resolvedAt: null,
      mappingId: {
        in: mappingIds,
      },
    },
    include: {
      mapping: {
        include: {
          person: {
            include: {
              phoneNumbers: true,
              emails: true,
              addresses: true,
              urls: true,
              imHandles: true,
              locations: true,
              customFields: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-surface shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          {t('title')}
        </h1>

        {conflicts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('noConflicts')}
            </h2>
            <p className="text-muted mb-6">
              {t('noConflictsDescription')}
            </p>
            <Link
              href="/settings/carddav"
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {t('backToSettings')}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-amber-800 dark:text-amber-200">
                ⚠️ {t('conflictsFound', { count: conflicts.length })}
              </p>
            </div>

            <ConflictList conflicts={conflicts} />

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Link
                href="/settings/carddav"
                className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('cancel')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
