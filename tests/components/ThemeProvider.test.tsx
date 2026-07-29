import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ThemeProvider, { useTheme, THEME_COLORS } from '@/components/ThemeProvider';

const LIGHT = '#F7F6F3';
const DARK = '#121110';

/**
 * Reads --background out of one selector block in app/globals.css. Throws
 * loudly rather than returning a default, because a silent miss here would make
 * the drift test below pass for the wrong reason.
 */
function backgroundFor(selector: string): string {
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf8');
  // Both selectors sit at the start of a line in this file.
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) {
    throw new Error(`No "${selector} {" at the start of a line in app/globals.css`);
  }
  const end = css.indexOf('\n}', start);
  const match = /--background:\s*([^;]+);/.exec(css.slice(start, end));
  if (!match) {
    throw new Error(`No --background declaration inside ${selector} in app/globals.css`);
  }
  return match[1].trim().toLowerCase();
}

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

    // fireEvent, not a raw DOM .click(): under React 19 the native click does
    // not flush the state update synchronously, so the assertion below would
    // read the stale value.
    fireEvent.click(screen.getByRole('button'));

    expect(metaThemeColor()).toBe(LIGHT);
    // Reused, not appended. Without this, a regression that created a fresh tag
    // on every theme change would still pass, because querySelector returns the
    // first match in document order.
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(1);
  });
});

describe('THEME_COLORS matches globals.css', () => {
  /*
   * The meta tag exists so browser chrome matches the page background, which
   * means THEME_COLORS is a duplicate of values that really live in the
   * stylesheet. The literals above would happily be edited in lockstep with a
   * wrong value, so this is the only assertion that catches real drift. The
   * palette is explicitly slated to evolve, so it will earn its keep.
   */
  it('uses the :root --background for LIGHT', () => {
    expect(THEME_COLORS.LIGHT.toLowerCase()).toBe(backgroundFor(':root'));
  });

  it('uses the .dark --background for DARK', () => {
    expect(THEME_COLORS.DARK.toLowerCase()).toBe(backgroundFor('.dark'));
  });
});
