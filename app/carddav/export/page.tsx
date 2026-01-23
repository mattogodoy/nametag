import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTranslations } from 'next-intl/server';
import BulkExportList from '@/components/BulkExportList';

export default async function ExportPage() {
  const session = await auth();
  const t = await getTranslations('carddav.export');

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

  // Get all people not yet exported (no CardDavMapping)
  const allPeople = await prisma.person.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      cardDavMapping: {
        select: {
          id: true,
        },
      },
    },
  });

  // Filter to only those without mapping
  const unmappedPeopleIds = allPeople
    .filter((p) => !p.cardDavMapping)
    .map((p) => p.id);

  // Get full details for unmapped people
  const unexcludedPeople = await prisma.person.findMany({
    where: {
      id: { in: unmappedPeopleIds },
    },
    include: {
      groups: {
        include: {
          group: true,
        },
      },
      phoneNumbers: true,
      emails: true,
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

        {unexcludedPeople.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('nothingToExport')}
            </h2>
            <p className="text-muted">
              {t('nothingToExportDescription')}
            </p>
          </div>
        ) : (
          <>
            <p className="text-muted mb-6">
              {t('description', { count: unexcludedPeople.length })}
            </p>

            <BulkExportList people={unexcludedPeople} />
          </>
        )}
      </div>
    </div>
  );
}
