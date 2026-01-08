'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import NavigationSearch from './NavigationSearch';
import UserMenu from './UserMenu';

interface NavigationProps {
  userEmail?: string;
  userName?: string | null;
  userNickname?: string | null;
  currentPath?: string;
}

export default function Navigation({ userEmail, userName, userNickname, currentPath }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/people', label: 'People', createHref: '/people/new', createLabel: 'person' },
    { href: '/groups', label: 'Groups', createHref: '/groups/new', createLabel: 'group' },
    { href: '/relationship-types', label: 'Relationships', createHref: '/relationship-types/new', createLabel: 'relationship' },
  ];

  const isActive = (href: string) => {
    if (!currentPath) return false;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <nav className="bg-surface shadow-lg border-b-2 border-primary/20 relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-tertiary/5 pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between items-center h-16">
          {/* Left section: Logo, Search (desktop), Nav items (desktop) */}
          <div className="flex items-center space-x-4 md:space-x-8">
            <Link href="/dashboard" className="flex items-center flex-shrink-0">
              <Image
                src="/logo.svg"
                alt="NameTag Logo"
                width={64}
                height={64}
                className="text-foreground"
              />
            </Link>

            {/* Desktop search */}
            <div className="hidden md:block">
              <NavigationSearch />
            </div>

            {/* Desktop nav items */}
            <div className="hidden lg:flex space-x-4">
              {navItems.map((item) => (
                <div key={item.href}>
                  {item.createHref ? (
                    <div className={`flex items-center rounded-md overflow-hidden border ${
                      isActive(item.href)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-surface-elevated border-border hover:bg-surface-elevated hover:border-primary/50'
                    }`}>
                      <Link
                        href={item.href}
                        className={`px-3 py-2 text-sm font-medium ${
                          isActive(item.href)
                            ? 'text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        {item.label}
                      </Link>
                      <div className={`w-px h-5 ${
                        isActive(item.href)
                          ? 'bg-primary/30'
                          : 'bg-border'
                      }`} />
                      <Link
                        href={item.createHref}
                        className={`px-2 py-2 transition-colors ${
                          isActive(item.href)
                            ? 'text-primary hover:text-primary-dark'
                            : 'text-muted hover:text-primary'
                        }`}
                        title={`Create new ${item.createLabel}`}
                        aria-label={`Create new ${item.createLabel}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        className={`px-3 py-2 rounded-md text-sm font-medium border ${
                          isActive(item.href)
                            ? 'text-primary bg-primary/10 border-primary'
                            : 'text-foreground bg-surface-elevated border-border hover:bg-surface-elevated hover:border-primary/50'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right section: User menu (all screens), Hamburger (mobile) */}
          <div className="flex items-center space-x-2">
            {userEmail && (
              <UserMenu userEmail={userEmail} userName={userName} userNickname={userNickname} />
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-foreground hover:bg-surface-elevated transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
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

      </div>

      {/* Mobile menu overlay - slides in from right */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Mobile menu panel */}
          <div className="lg:hidden fixed top-0 right-0 bottom-0 w-[90%] max-w-md bg-surface shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
            <div className="h-full flex flex-col">
              {/* Menu header with close button */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-md text-muted hover:bg-surface-elevated transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className={`flex-1 px-4 py-3 text-base font-medium ${
                              isActive(item.href)
                                ? 'text-primary'
                                : 'text-foreground'
                            }`}
                          >
                            {item.label}
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
                            title={`Create new ${item.createLabel}`}
                            aria-label={`Create new ${item.createLabel}`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center px-4 py-3 rounded-lg text-base font-medium border transition-colors ${
                            isActive(item.href)
                              ? 'text-primary bg-primary/10 border-primary'
                              : 'text-foreground bg-surface-elevated border-border hover:bg-surface-elevated hover:border-primary/50'
                          }`}
                        >
                          {item.label}
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
