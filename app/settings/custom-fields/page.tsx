import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isFeatureEnabled } from '@/lib/features';
import { canCreateResource } from '@/lib/billing/subscription';
import { getTranslations } from 'next-intl/server';
import CustomFieldsManager from '@/components/customFields/CustomFieldsManager';

export default async function CustomFieldsSettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userId = session.user.id;

  const templates = await prisma.customFieldTemplate.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { values: true } } },
  });

  const usage = isFeatureEnabled('tierLimits')
    ? await canCreateResource(userId, 'customFieldTemplates')
    : null;

  const t = await getTranslations('customFields.settings');

  return (
    <div className="bg-surface shadow rounded-lg">
      <div className="px-6 py-5 border-b border-border">
        <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('description')}</p>
      </div>
      <div className="p-6">
        <CustomFieldsManager initialTemplates={templates} usage={usage} />
      </div>
    </div>
  );
}
