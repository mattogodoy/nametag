'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

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

export default function ThemeProvider({ children, initialTheme = 'DARK' }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    // Apply theme class to html element
    const root = document.documentElement;
    if (theme === 'DARK') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Also sync initial theme on mount
  useEffect(() => {
    const root = document.documentElement;
    if (initialTheme === 'DARK') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [initialTheme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'DARK' ? 'LIGHT' : 'DARK');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
