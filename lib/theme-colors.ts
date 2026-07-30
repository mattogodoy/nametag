/**
 * Plain data module, deliberately NOT marked 'use client'. app/layout.tsx is a
 * server component that needs these values for viewport.themeColor, and
 * marking this file 'use client' would turn its exports into client
 * references that a server component cannot import directly.
 *
 * Must match --background in app/globals.css for each theme.
 * tests/components/ThemeProvider.test.tsx couples these values to the
 * stylesheet so they cannot drift apart silently.
 */
export type Theme = 'LIGHT' | 'DARK';

export const THEME_COLORS: Record<Theme, string> = {
  LIGHT: '#F7F6F3',
  DARK: '#121110',
};
