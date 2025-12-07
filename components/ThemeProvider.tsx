'use client';

import { createContext, useContext, useEffect, useState, useLayoutEffect, ReactNode } from 'react';

type Theme = 'LIGHT' | 'DARK';

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
