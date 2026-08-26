'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { handleSignOut } from '@/app/actions/auth';

const VARIANTS = {
  /** Desktop dropdown: tight rows inside a small floating panel. */
  compact: 'px-4 py-2 text-sm',
  /** Mobile drawer: touch-sized rows matching the nav items above them. */
  comfortable: 'px-4 py-3 text-base',
} as const;

interface AccountMenuItemsProps {
  variant?: keyof typeof VARIANTS;
  onNavigate?: () => void;
}

/**
 * Settings, documentation and sign out. Rendered both in the desktop user
 * dropdown and in the mobile navigation drawer, so the two can't drift apart.
 */
export default function AccountMenuItems({ variant = 'compact', onNavigate }: AccountMenuItemsProps) {
  const t = useTranslations('nav.userMenu');
  const row = `flex items-center gap-2 text-foreground hover:bg-surface-elevated transition-colors ${VARIANTS[variant]}`;

  const onSignOut = async () => {
    onNavigate?.();
    await handleSignOut();
  };

  return (
    <>
      <Link href="/settings" onClick={onNavigate} className={row}>
        <svg className="w-4 h-4 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {t('settings')}
      </Link>
      <a
        href="https://docs.nametag.one"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className={row}
      >
        <svg className="w-4 h-4 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        {t('documentation')}
      </a>
      <hr className="my-1 border-border" />
      <button onClick={onSignOut} className={`w-full text-left cursor-pointer ${row}`}>
        <svg className="w-4 h-4 text-tertiary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        {t('signOut')}
      </button>
    </>
  );
}
