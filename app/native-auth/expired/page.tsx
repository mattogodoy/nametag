import { getTranslations } from 'next-intl/server';

/**
 * Shown when a native sign-in link is stale or malformed. Needs no session:
 * it is reached from a private browser sheet that is not signed in.
 */
export default async function NativeAuthExpiredPage() {
  const t = await getTranslations('nativeAuth.expired');
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface shadow rounded-lg p-8 text-center">
        <h1 className="text-xl font-bold text-foreground mb-3">{t('title')}</h1>
        <p className="text-muted">{t('body')}</p>
      </div>
    </main>
  );
}
