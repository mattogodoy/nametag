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
        <Button variant="primary" onClick={() => window.location.reload()}>
          {t('retry')}
        </Button>
      </div>
    </div>
  );
}
