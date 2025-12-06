'use client';

import Link from 'next/link';
import { handleSignOut } from '@/app/actions/auth';

interface UserMenuProps {
  userEmail?: string;
  userName?: string | null;
  userNickname?: string | null;
}

export default function UserMenu({ userEmail, userName, userNickname }: UserMenuProps) {
  const onSignOut = async () => {
    await handleSignOut();
  };

  const displayName = userNickname || userName || userEmail;
  const initials = displayName ? displayName.slice(0, 2).toUpperCase() : 'U';

  return (
    <div className="dropdown relative inline-flex rtl:[--placement:bottom-end]">
      <button
        id="dropdown-user-menu"
        type="button"
        className="dropdown-toggle btn btn-ghost gap-2"
        aria-haspopup="menu"
        aria-expanded="false"
        aria-label="User menu"
      >
        <div className="avatar avatar-placeholder">
          <div className="bg-primary text-primary-content w-8 rounded-full">
            <span className="text-sm">{initials}</span>
          </div>
        </div>
        <span className="hidden sm:inline text-sm">{displayName}</span>
        <span className="icon-[tabler--chevron-down] dropdown-open:rotate-180 size-4 transition-transform" />
      </button>
      <ul
        className="dropdown-menu dropdown-open:opacity-100 hidden min-w-48"
        role="menu"
        aria-orientation="vertical"
        aria-labelledby="dropdown-user-menu"
      >
        <li className="dropdown-header">
          <span className="block text-sm font-medium">{userName || 'User'}</span>
          <span className="block text-xs text-base-content/60">{userEmail}</span>
        </li>
        <li className="dropdown-divider" role="separator"></li>
        <li>
          <Link href="/settings" className="dropdown-item">
            <span className="icon-[tabler--settings] size-4" />
            Settings
          </Link>
        </li>
        <li className="dropdown-divider" role="separator"></li>
        <li>
          <button onClick={onSignOut} className="dropdown-item text-error">
            <span className="icon-[tabler--logout] size-4" />
            Sign out
          </button>
        </li>
      </ul>
    </div>
  );
}
