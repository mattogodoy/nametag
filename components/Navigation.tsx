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

  // Re-initialize FlyonUI components when mobile menu opens
  useEffect(() => {
    if (typeof window !== 'undefined' && mobileMenuOpen) {
      // @ts-expect-error FlyonUI global
      window.HSStaticMethods?.autoInit();
    }
  }, [mobileMenuOpen]);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: 'icon-[tabler--layout-dashboard]' },
    { href: '/people', label: 'People', icon: 'icon-[tabler--users]' },
    { href: '/groups', label: 'Groups', icon: 'icon-[tabler--folders]' },
    { href: '/relationship-types', label: 'Relationships', icon: 'icon-[tabler--heart-handshake]' },
  ];

  const isActive = (href: string) => {
    if (!currentPath) return false;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <nav className="navbar bg-base-200 shadow-sm">
      <div className="navbar-start gap-2">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="btn btn-square btn-ghost lg:hidden"
          aria-label="Toggle menu"
        >
          <span className={mobileMenuOpen ? 'icon-[tabler--x] size-5' : 'icon-[tabler--menu-2] size-5'} />
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/logo.svg"
            alt="NameTag Logo"
            width={48}
            height={48}
          />
        </Link>

        {/* Desktop search */}
        <div className="hidden md:block ml-4">
          <NavigationSearch />
        </div>
      </div>

      {/* Desktop nav items */}
      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal gap-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={isActive(item.href) ? 'active' : ''}
              >
                <span className={`${item.icon} size-4`} />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Right section */}
      <div className="navbar-end">
        {userEmail && (
          <UserMenu userEmail={userEmail} userName={userName} userNickname={userNickname} />
        )}
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-base-300/80 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu drawer */}
      <div className={`fixed top-0 left-0 z-50 h-full w-64 bg-base-200 shadow-xl transform transition-transform duration-300 lg:hidden ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
              <Image
                src="/logo.svg"
                alt="NameTag Logo"
                width={48}
                height={48}
              />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-square btn-ghost btn-sm"
              aria-label="Close menu"
            >
              <span className="icon-[tabler--x] size-5" />
            </button>
          </div>

          {/* Mobile search */}
          <div className="mb-4 md:hidden">
            <NavigationSearch />
          </div>

          {/* Mobile nav items */}
          <ul className="menu gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={isActive(item.href) ? 'active' : ''}
                >
                  <span className={`${item.icon} size-5`} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
