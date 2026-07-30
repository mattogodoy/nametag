'use client';

import { createContext, useContext, useEffect, useState, useLayoutEffect, ReactNode } from 'react';
import { THEME_COLORS, type Theme } from '@/lib/theme-colors';

export { THEME_COLORS };

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
}

/*
 * Keeps <meta name="theme-color"> in step with the active theme. This tints the
 * browser and OS chrome, which matters most in an installed PWA where a light
 * status bar above a dark app looks broken.
 *
 * Done on the client rather than in generateViewport() because the theme is a
 * per-user database value that can be toggled without a reload, and a server
 * export cannot react to that.
 */
function applyThemeColorMeta(theme: Theme) {
  if (typeof document === 'undefined') {
    return;
  }
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLORS[theme]);
}

// Apply theme class to document - runs synchronously to avoid flash
function applyThemeClass(theme: Theme) {
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (theme === 'DARK') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
  applyThemeColorMeta(theme);
}

export default function ThemeProvider({ children, initialTheme = 'DARK' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  // Use useLayoutEffect to apply theme synchronously before paint
  // This prevents flash of wrong theme
  useLayoutEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Sync state if initialTheme changes (e.g., after navigation)
  useEffect(() => {
    setThemeState(initialTheme);
  }, [initialTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'DARK' ? 'LIGHT' : 'DARK');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
