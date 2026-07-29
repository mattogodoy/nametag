'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

const DISMISS_KEY = 'nametag.installPromptDismissed';

/**
 * One-time, dismissible install nudge. Rendered on the dashboard only, so it
 * cannot interrupt someone mid-task.
 */
export default function InstallPrompt() {
  const t = useTranslations('pwa.install');
  const { isStandalone, canPrompt, isIos, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);

  // Read in an effect: localStorage is not available during server render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting a one-time platform check (persisted dismissal) into UI state is intentional
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  if (isStandalone || dismissed) {
    return null;
  }

  // On iOS there is no install API, so the only useful thing is instructions.
  const showIosHelp = isIos;
  if (!canPrompt && !showIosHelp) {
    return null;
  }

  return (
    <div className="bg-surface rounded-lg p-6 mb-8 border border-border">
      <h2 className="text-lg font-bold text-foreground mb-2">
        {showIosHelp ? t('iosTitle') : t('title')}
      </h2>
      <p className="text-muted mb-4">{t('description')}</p>

      {showIosHelp ? (
        <ol className="text-sm text-muted list-decimal list-inside space-y-1 mb-4">
          <li>{t('iosStep1')}</li>
          <li>{t('iosStep2')}</li>
          <li>{t('iosStep3')}</li>
        </ol>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canPrompt ? (
          <Button variant="primary" size="sm" onClick={() => void promptInstall()}>
            {t('button')}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={dismiss}>
          {t('dismiss')}
        </Button>
      </div>
    </div>
  );
}
