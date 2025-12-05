'use client';

import { useState } from 'react';
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

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/people', label: 'People' },
    { href: '/groups', label: 'Groups' },
    { href: '/relationship-types', label: 'Relationships' },
  ];

  const isActive = (href: string) => {
    if (!currentPath) return false;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left section: Logo, Search (desktop), Nav items (desktop) */}
          <div className="flex items-center space-x-4 md:space-x-8">
            <Link href="/dashboard" className="flex items-center flex-shrink-0">
              <Image
                src="/logo.svg"
                alt="NameTag Logo"
                width={64}
                height={64}
                className="text-gray-900 dark:text-white"
              />
            </Link>

            {/* Desktop search */}
            <div className="hidden md:block">
              <NavigationSearch />
            </div>

            {/* Desktop nav items */}
            <div className="hidden lg:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive(item.href)
                      ? 'text-blue-600 dark:text-blue-400 px-3 py-2 rounded-md text-sm font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium'
                  }
                >
                  {item.label}
                </Link>
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
              className="lg:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 dark:border-gray-700 py-4">
            {/* Mobile search */}
            <div className="mb-4 md:hidden">
              <NavigationSearch />
            </div>

            {/* Mobile nav items */}
            <div className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={
                    isActive(item.href)
                      ? 'block px-3 py-2 rounded-md text-base font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
