'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * Permanent counterpart to InstallPrompt. Always available and never
 * dismissible, so someone who waved the banner away can still find this.
 */
export default function InstallAppSettings() {
  const t = useTranslations('pwa.install');
  const { isStandalone, canPrompt, isIos, promptInstall } = usePwaInstall();

  if (isStandalone) {
    return <p className="text-sm text-muted">{t('installed')}</p>;
  }

  if (canPrompt) {
    return (
      <div>
        <p className="text-sm text-muted mb-4">{t('description')}</p>
        <Button variant="primary" onClick={() => void promptInstall()}>
          {t('button')}
        </Button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div>
        <p className="text-sm text-muted mb-4">{t('description')}</p>
        <p className="text-sm font-medium text-foreground mb-2">{t('iosTitle')}</p>
        <ol className="text-sm text-muted list-decimal list-inside space-y-1">
          <li>{t('iosStep1')}</li>
          <li>{t('iosStep2')}</li>
          <li>{t('iosStep3')}</li>
        </ol>
      </div>
    );
  }

  return <p className="text-sm text-muted">{t('unsupported')}</p>;
}
