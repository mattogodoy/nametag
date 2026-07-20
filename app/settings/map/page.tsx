import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getTranslations } from 'next-intl/server';
import GeocodingToggle from '@/components/GeocodingToggle';

export default async function MapSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('settings.map');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { geocodingEnabled: true },
  });

  const providerHost = new URL(env.GEOCODER_URL).host;

  return (
    <div className="space-y-6">
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">{t('geocodingTitle')}</h2>
        <p className="text-muted mb-6">{t('geocodingDescription', { provider: providerHost })}</p>
        <GeocodingToggle currentEnabled={user?.geocodingEnabled ?? true} />
      </div>
    </div>
  );
}
