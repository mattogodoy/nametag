'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { handleSignOut } from '@/app/actions/auth';
import { getUserPhotoUrl } from '@/lib/photo-url';

interface UserMenuProps {
  userEmail?: string;
  userName?: string | null;
  userNickname?: string | null;
  userPhoto?: string | null;
}

export default function UserMenu({ userEmail, userName, userNickname, userPhoto }: UserMenuProps) {
  const t = useTranslations('nav.userMenu');
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const onSignOut = async () => {
    await handleSignOut();
  };

  const photoUrl = getUserPhotoUrl(userPhoto);
  const displayName = userNickname || userName || userEmail || '?';
  const initials = (displayName || '?').charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
      >
        {photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photoUrl}
            alt=""
            className="w-8 h-8 rounded-full object-cover bg-surface border border-border flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-medium text-secondary">{initials}</span>
          </div>
        )}
        <span>{userNickname || userName || userEmail}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-surface rounded-lg shadow-lg py-1 z-50 border border-border">
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors"
          >
            <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {t('settings')}
          </Link>
          <hr className="my-1 border-border" />
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
