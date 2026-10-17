'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { getPhotoUrl } from '@/lib/photo-url';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface PhotoLightboxProps {
  personId: string;
  name: string;
  photo: string | null | undefined;
  children: React.ReactNode;
}

export default function PhotoLightbox({
  personId,
  name,
  photo,
  children,
}: PhotoLightboxProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('people');

  const src = getPhotoUrl(personId, photo);

  const close = useCallback(() => setOpen(false), []);
  const dialogRef = useRef<HTMLDivElement>(null);

  // aria-modal tells assistive technology the page behind is inert, so focus
  // has to move in, stay in, and come back to the avatar on close.
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!src) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={t('viewPhoto')}
      >
        {children}
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-in fade-in duration-200"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={t('viewPhoto')}
        >
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label={t('close')}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[80vw] max-h-[80vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
