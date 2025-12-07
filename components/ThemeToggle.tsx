'use client';

import { useState } from 'react';
import { useTheme } from './ThemeProvider';

interface ThemeToggleProps {
  userId: string;
  currentTheme: 'LIGHT' | 'DARK';
}

export default function ThemeToggle({ userId, currentTheme }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleThemeChange = async () => {
    const newTheme = theme === 'DARK' ? 'LIGHT' : 'DARK';
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme }),
      });

      if (!response.ok) {
        throw new Error('Failed to update theme');
      }

      setTheme(newTheme);
      setMessage('Theme updated successfully!');
    } catch {
      setMessage('Failed to update theme. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Choose your preferred theme
      </p>

      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Light
        </span>

        <button
          onClick={handleThemeChange}
          disabled={isLoading}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed ${
            theme === 'DARK'
              ? 'bg-blue-600'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
          aria-label="Toggle theme"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
              theme === 'DARK' ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>

        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Dark
        </span>
      </div>

      {message && (
        <p className={`mt-4 text-sm ${message.includes('success') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
