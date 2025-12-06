'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ThemeToggleProps {
  userId: string;
  currentTheme: 'LIGHT' | 'DARK';
}

export default function ThemeToggle({ userId, currentTheme }: ThemeToggleProps) {
  const router = useRouter();
  const [theme, setTheme] = useState('DARK');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleThemeChange = async () => {
    // Disabled for now
    return;
  };

  return (
    <div>
      <p className="text-sm text-base-content/60 mb-4">
        Choose your preferred theme
      </p>

      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="icon-[tabler--sun] size-4" />
          Light
        </span>

        <input
          type="checkbox"
          checked={theme === 'DARK'}
          disabled={true}
          onChange={handleThemeChange}
          className="toggle toggle-primary"
        />

        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="icon-[tabler--moon] size-4" />
          Dark
        </span>

        <span className="badge badge-ghost text-xs italic">
          Coming soon!
        </span>
      </div>

      {message && (
        <div className={`mt-4 ${message.includes('success') ? 'text-success' : 'text-error'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
