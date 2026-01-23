import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import CardDavConnectionForm from '@/components/CardDavConnectionForm';
import { getTranslations } from 'next-intl/server';

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

  return (
    <div className="bg-surface shadow rounded-lg p-6">
      <h2 className="text-xl font-bold text-foreground mb-4">
        {t('title')}
      </h2>
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
