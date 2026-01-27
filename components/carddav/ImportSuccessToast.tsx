'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function ImportSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('settings.carddav.import');
  const hasShownToast = useRef(false);

  useEffect(() => {
    const importSuccess = searchParams.get('importSuccess');
    const imported = searchParams.get('imported');
    const skipped = searchParams.get('skipped');
    const errors = searchParams.get('errors');

    if (importSuccess === 'true' && !hasShownToast.current) {
      hasShownToast.current = true;

      const importedCount = parseInt(imported || '0', 10);
      const skippedCount = parseInt(skipped || '0', 10);
      const errorsCount = parseInt(errors || '0', 10);

      if (errorsCount > 0) {
        // Show warning toast if there were errors
        toast.warning(
          t('importCompleteWithErrors', {
            imported: importedCount,
            errors: errorsCount,
          })
        );
      } else {
        // Show success toast
        toast.success(
          t('importSuccessToast', {
            imported: importedCount,
            skipped: skippedCount,
          })
        );
      }

      // Clean up URL params
      router.replace('/settings/carddav', { scroll: false });
    }
  }, [searchParams, router, t]);

  return null;
}
