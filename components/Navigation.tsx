'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import NavigationSearch from './NavigationSearch';
import UserMenu from './UserMenu';

interface NavigationProps {
  userEmail?: string;
  userName?: string | null;
  userNickname?: string | null;
  userPhoto?: string | null;
  currentPath?: string;
}

const navIcons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  people: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  groups: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" />
    </svg>
  ),
  journal: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  ),
  relationshipTypes: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
};

const navItems = [
  { href: '/dashboard', labelKey: 'dashboard' },
  { href: '/people', labelKey: 'people', createHref: '/people/new', createLabelKey: 'people' },
  { href: '/groups', labelKey: 'groups', createHref: '/groups/new', createLabelKey: 'groups' },
  { href: '/journal', labelKey: 'journal', createHref: '/journal/new', createLabelKey: 'journal' },
  { href: '/relationship-types', labelKey: 'relationshipTypes', createHref: '/relationship-types/new', createLabelKey: 'relationshipTypes' },
];

export default function Navigation({ userEmail, userName, userNickname, userPhoto, currentPath }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => {
    if (!currentPath) return false;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <nav className="bg-surface border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top row: Logo, Search (centered), User menu */}
        <div className="relative z-30 flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center shrink-0 z-10">
            <Image
              src="/logo.svg"
              alt="Nametag Logo"
              width={64}
              height={64}
              className="text-foreground"
            />
          </Link>

          {/* Desktop search — absolutely centered in the row */}
          <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-full max-w-md lg:max-w-lg px-20 lg:px-24">
            <NavigationSearch />
          </div>

          {/* Right section: User menu (all screens), Hamburger (mobile) */}
          <div className="flex items-center space-x-2 z-10">
            {userEmail && (
              <UserMenu userEmail={userEmail} userName={userName} userNickname={userNickname} userPhoto={userPhoto} />
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-3 rounded-md text-foreground hover:bg-surface-elevated transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Separator between rows */}
        <div className="hidden md:block border-t border-border" />

        {/* Bottom row: Nav items as tab bar (desktop) */}
        <div className="hidden md:flex items-center justify-center gap-1">
          {navItems.map((item) => (
            <div key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-primary'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                {navIcons[item.labelKey]}
                {tNav(item.labelKey)}
              </Link>
              {/* Active indicator bar */}
              {isActive(item.href) && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </div>
          ))}
        </div>

      </div>

      {/* Mobile menu overlay - slides in from right */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Mobile menu panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="md:hidden fixed top-0 right-0 bottom-0 w-[90%] max-w-md bg-surface shadow-xl z-50 transform transition-transform duration-300 ease-in-out pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]"
          >
            <div className="h-full flex flex-col">
              {/* Menu header with close button */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md text-muted hover:bg-surface-elevated transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile search */}
              <div className="p-4 border-b border-border md:hidden">
                <NavigationSearch />
              </div>

              {/* Mobile nav items */}
              <nav className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <div key={item.href}>
                      {item.createHref ? (
                        <div className={`flex items-center rounded-lg overflow-hidden border ${
                          isActive(item.href)
                            ? 'bg-primary/10 border-primary'
                            : 'bg-surface-elevated border-border hover:bg-surface-elevated hover:border-primary/50'
                        }`}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex-1 flex items-center gap-2 px-4 py-3 text-base font-medium ${
                              isActive(item.href)
                                ? 'text-primary'
                                : 'text-foreground'
                            }`}
                          >
                            {navIcons[item.labelKey]}
                            {tNav(item.labelKey)}
                          </Link>
                          <div className={`w-px h-8 ${
                            isActive(item.href)
                              ? 'bg-primary/30'
                              : 'bg-border'
                          }`} />
                          <Link
                            href={item.createHref}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`px-4 py-3 transition-colors ${
                              isActive(item.href)
                                ? 'text-primary'
                                : 'text-muted hover:text-primary'
                            }`}
                            aria-label={`${tCommon('create')} ${tNav(item.createLabelKey || item.labelKey)}`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-lg text-base font-medium border transition-colors ${
                            isActive(item.href)
                              ? 'text-primary bg-primary/10 border-primary'
                              : 'text-foreground bg-surface-elevated border-border hover:bg-surface-elevated hover:border-primary/50'
                          }`}
                        >
                          {navIcons[item.labelKey]}
                          {tNav(item.labelKey)}
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </nav>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
