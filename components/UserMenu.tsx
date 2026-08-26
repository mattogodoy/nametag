'use client';

import { useState, useRef, useEffect } from 'react';
import AccountMenuItems from './AccountMenuItems';
import UserAvatar from './UserAvatar';
import { formatUserDisplayName } from '@/lib/nameUtils';

interface UserMenuProps {
  userEmail?: string;
  userName?: string | null;
  userNickname?: string | null;
  userPhoto?: string | null;
}

export default function UserMenu({ userEmail, userName, userNickname, userPhoto }: UserMenuProps) {
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

  const displayName = formatUserDisplayName({ nickname: userNickname, name: userName, email: userEmail });

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-surface-elevated transition-colors"
      >
        <UserAvatar displayName={displayName} photo={userPhoto} />
        <span>{displayName}</span>
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
          <AccountMenuItems onNavigate={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
}
