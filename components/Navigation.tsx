import Link from 'next/link';
import { signOut } from '@/lib/auth';
import NavigationSearch from './NavigationSearch';

interface NavigationProps {
  userEmail?: string;
  userName?: string | null;
  currentPath?: string;
}

export default function Navigation({ userEmail, userName, currentPath }: NavigationProps) {
  const navItems = [
    { href: '/people', label: 'People' },
    { href: '/groups', label: 'Groups' },
    { href: '/relationship-types', label: 'Relationship Types' },
  ];

  const isActive = (href: string) => {
    if (!currentPath) return false;
    return currentPath === href || currentPath.startsWith(`${href}/`);
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold text-gray-900 dark:text-white">
              Name Tag
            </Link>
            <div className="flex space-x-4">
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
          <div className="flex items-center space-x-4">
            <NavigationSearch />
            {userEmail && (
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {userName || userEmail}
              </span>
            )}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}
