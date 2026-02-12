'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function ImportSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('settings.carddav.import');
  const hasShownToast = useRef(false);

  useEffect(() => {
    // Only show toast once
    if (hasShownToast.current) {
      return;
    }

    const importSuccess = searchParams.get('importSuccess');
    const imported = searchParams.get('imported');
    const skipped = searchParams.get('skipped');
    const errors = searchParams.get('errors');

    if (importSuccess === 'true') {
      hasShownToast.current = true;

      const importedCount = parseInt(imported || '0', 10);
      const skippedCount = parseInt(skipped || '0', 10);
      const errorsCount = parseInt(errors || '0', 10);

      if (errorsCount > 0) {
        toast.error(
          t('importCompleteWithErrors', {
            imported: importedCount,
            errors: errorsCount,
          })
        );
      } else if (importedCount > 0) {
        toast.success(
          t('importSuccessToast', {
            imported: importedCount,
            skipped: skippedCount,
          })
        );
      }

      // Clean up URL parameters after showing toast
      const url = new URL(window.location.href);
      url.searchParams.delete('importSuccess');
      url.searchParams.delete('imported');
      url.searchParams.delete('skipped');
      url.searchParams.delete('errors');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router, t]);

  return null;
}
