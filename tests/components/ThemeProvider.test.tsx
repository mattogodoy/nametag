import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeProvider, { useTheme } from '@/components/ThemeProvider';

const LIGHT = '#F7F6F3';
const DARK = '#121110';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" onClick={toggleTheme}>
      {theme}
    </button>
  );
}

function metaThemeColor(): string | null {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null;
}

describe('ThemeProvider theme-color sync', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.documentElement.className = '';
  });

  it('sets the meta tag to the dark background when the theme is dark', () => {
    render(
      <ThemeProvider initialTheme="DARK">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(metaThemeColor()).toBe(DARK);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sets the meta tag to the light background when the theme is light', () => {
    render(
      <ThemeProvider initialTheme="LIGHT">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(metaThemeColor()).toBe(LIGHT);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('creates the meta tag when the document does not already have one', () => {
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();

    render(
      <ThemeProvider initialTheme="DARK">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });

  it('reuses an existing meta tag rather than adding a second', () => {
    const existing = document.createElement('meta');
    existing.setAttribute('name', 'theme-color');
    existing.setAttribute('content', DARK);
    document.head.appendChild(existing);

    render(
      <ThemeProvider initialTheme="LIGHT">
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
    expect(metaThemeColor()).toBe(LIGHT);
  });

  it('updates the meta tag when the theme is toggled at runtime', () => {
    render(
      <ThemeProvider initialTheme="DARK">
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(metaThemeColor()).toBe(DARK);

    fireEvent.click(screen.getByRole('button'));

    expect(metaThemeColor()).toBe(LIGHT);
  });
});
