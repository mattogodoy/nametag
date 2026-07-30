'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export default function OfflineNotice() {
  const t = useTranslations('pwa.offline');

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <Image
          src="/logo.svg"
          alt=""
          width={96}
          height={65}
          className="mx-auto mb-8 opacity-60"
          priority
        />
        <h1 className="text-2xl font-bold text-foreground mb-3">{t('title')}</h1>
        <p className="text-muted mb-8">{t('message')}</p>
        {/*
         * A link, not an onClick handler. This component's client chunk is only
         * ever requested by someone who visits /offline while online (it appears
         * in no other route's client reference manifest), so when the service
         * worker serves this page for a failed navigation, hydration never
         * completes and any JS handler would be permanently dead. Button with
         * href server-renders a plain anchor, which works with zero JavaScript
         * and simply re-enters the worker's navigate branch on click.
         */}
        <Button variant="primary" href="/">
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}
