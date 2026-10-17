import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import PasswordChangeForm from '@/components/PasswordChangeForm';
import DeviceSessionsCard from '@/components/DeviceSessionsCard';
import { getTranslations } from 'next-intl/server';

export default async function SecuritySettingsPage() {
  const session = await auth();
  const t = await getTranslations('settings.security');

  if (!session?.user) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { dateFormat: true },
  });

  return (
    <>
      <div className="bg-surface shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">
          {t('passwordTitle')}
        </h2>
        <p className="text-muted mb-2">
          {t('passwordDescription')}
        </p>
        <p className="text-muted text-sm mb-6">
          {t('passwordSignsOutEverywhere')}
        </p>
        <PasswordChangeForm userId={session.user.id} />
      </div>
      <DeviceSessionsCard dateFormat={user?.dateFormat ?? 'MDY'} />
    </>
  );
}
