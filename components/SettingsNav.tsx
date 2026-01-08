'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const allSettingsNavItems = [
  {
    href: '/settings/profile',
    label: 'Profile',
    description: 'Name, email, and personal info',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: '/settings/appearance',
    label: 'Appearance',
    description: 'Theme and date format',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
      </svg>
    ),
  },
  {
    href: '/settings/security',
    label: 'Security',
    description: 'Password and authentication',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    href: '/settings/billing',
    label: 'Billing',
    description: 'Plan, usage, and payments',
    saasOnly: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: '/settings/account',
    label: 'Account',
    description: 'Export, import, and delete',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/settings/about',
    label: 'About',
    description: 'Version and information',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function SettingsNav({ isSaasMode }: { isSaasMode: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  // Filter out SaaS-only items when not in SaaS mode
  const settingsNavItems = allSettingsNavItems.filter(
    (item) => !item.saasOnly || isSaasMode
  );

  // Find current active item
  const activeItem = settingsNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  // Handle mobile dropdown change
  const handleMobileChange = (href: string) => {
    router.push(href);
  };

  return (
    <div>
      {/* Mobile: Dropdown menu */}
      <div className="md:hidden bg-surface shadow rounded-lg p-4">
        <label htmlFor="settings-menu" className="block text-sm font-medium text-muted mb-2">
          Settings Menu
        </label>
        <div className="relative">
          <select
            id="settings-menu"
            value={activeItem?.href || settingsNavItems[0]?.href}
            onChange={(e) => handleMobileChange(e.target.value)}
            className="block w-full rounded-lg border border-border bg-surface text-foreground shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 pl-3 pr-10 text-base appearance-none"
          >
            {settingsNavItems.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label} - {item.description}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-muted">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Desktop: Sidebar navigation */}
      <nav className="hidden md:block bg-surface shadow rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {settingsNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-4 border-blue-600'
                      : 'text-muted hover:bg-surface-elevated/50 border-l-4 border-transparent'
                  }`}
                >
                  <span className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-muted'}>
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className={`font-medium ${isActive ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                      {item.label}
                    </p>
                    <p className="text-sm text-muted truncate">
                      {item.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
