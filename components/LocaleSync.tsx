'use client';

import { useEffect } from 'react';

interface LocaleSyncProps {
  locale: string;
}

export default function LocaleSync({ locale }: LocaleSyncProps) {
  useEffect(() => {
    const cookies = document.cookie.split(';').map(c => c.trim());
    const localeCookie = cookies.find(c => c.startsWith('NEXT_LOCALE='));
    const cookieValue = localeCookie?.split('=')[1];

    if (cookieValue === locale) return;

    const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
    const domainAttr = domain ? `; domain=${domain}` : '';
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax${domainAttr}`;

    const updated = document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith('NEXT_LOCALE='));
    if (updated?.split('=')[1] === locale) {
      window.location.reload();
    }
  }, [locale]);

  return null;
}
