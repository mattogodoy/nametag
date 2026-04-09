import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('settings');

  return (
    <div className="space-y-4">
      {/* Profile */}
      <Link
        href="/settings/profile"
        className="block bg-surface shadow rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('profile.title')}</h3>
            <p className="text-sm text-muted">{t('profile.description')}</p>
          </div>
        </div>
      </Link>

      {/* Integrations */}
      <Link
        href="/settings/integrations"
        className="block bg-surface shadow rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('integrations.title')}</h3>
            <p className="text-sm text-muted">{t('integrations.description')}</p>
          </div>
        </div>
      </Link>

      {/* Security */}
      <Link
        href="/settings/security"
        className="block bg-surface shadow rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('security.title')}</h3>
            <p className="text-sm text-muted">{t('security.description')}</p>
          </div>
        </div>
      </Link>

      {/* Account */}
      <Link
        href="/settings/account"
        className="block bg-surface shadow rounded-lg p-6 border border-border hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('account.title')}</h3>
            <p className="text-sm text-muted">{t('account.description')}</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
