import { describe, it, expect, vi, beforeEach } from 'vitest';
import manifest from '@/app/manifest';

const mocks = vi.hoisted(() => ({
  getLocaleFromCookie: vi.fn(),
  detectBrowserLocale: vi.fn(),
}));

/**
 * Mocked with a minimal factory rather than importActual, because the real
 * lib/locale pulls in Prisma and Pino, neither of which loads cleanly under
 * jsdom. getUserLocale is included because lib/i18n-utils imports it, though
 * nothing here calls it. Same approach as tests/lib/i18n-utils.test.ts.
 */
vi.mock('@/lib/locale', () => ({
  getLocaleFromCookie: mocks.getLocaleFromCookie,
  detectBrowserLocale: mocks.detectBrowserLocale,
  getUserLocale: vi.fn(),
}));

const SUPPORTED_LOCALES = [
  'en', 'es-ES', 'ja-JP', 'nb-NO', 'de-DE', 'zh-CN', 'it-IT', 'ru-RU', 'nl-NL',
] as const;

describe('app/manifest.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocaleFromCookie.mockResolvedValue(null);
    mocks.detectBrowserLocale.mockResolvedValue('en');
  });

  it('sets a stable app identity and launch behaviour', async () => {
    const result = await manifest();

    expect(result.id).toBe('/');
    expect(result.name).toBe('Nametag');
    expect(result.short_name).toBe('Nametag');
    // start_url is '/' so app/page.tsx can redirect based on session state.
    // Pointing at /dashboard would show an auth redirect on cold launch.
    expect(result.start_url).toBe('/');
    expect(result.display).toBe('standalone');
    expect(result.background_color).toBe('#121110');
    expect(result.theme_color).toBe('#121110');
    expect(result.categories).toEqual(['productivity', 'lifestyle']);
  });

  it('does not lock orientation', async () => {
    const result = await manifest();
    expect(result.orientation).toBeUndefined();
  });

  it('declares both any and maskable icons at 192 and 512', async () => {
    const result = await manifest();
    const icons = result.icons ?? [];

    expect(icons).toHaveLength(4);
    for (const purpose of ['any', 'maskable']) {
      for (const size of ['192x192', '512x512']) {
        const match = icons.find((i) => i.purpose === purpose && i.sizes === size);
        expect(match, `${purpose} ${size}`).toBeDefined();
        expect(match?.type).toBe('image/png');
      }
    }
  });

  it('points icons at real files under /icons/', async () => {
    const result = await manifest();
    const srcs = (result.icons ?? []).map((i) => i.src).sort();
    expect(srcs).toEqual([
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/maskable-192.png',
      '/icons/maskable-512.png',
    ]);
  });

  it('declares three shortcuts', async () => {
    const result = await manifest();
    const shortcuts = result.shortcuts ?? [];

    expect(shortcuts.map((s) => s.url)).toEqual(['/people/new', '/people', '/dashboard']);
    for (const shortcut of shortcuts) {
      expect(shortcut.name).toBeTruthy();
    }
  });

  it('uses English copy by default', async () => {
    const result = await manifest();

    expect(result.lang).toBe('en');
    expect(result.description).toBe('Keep track of the people in your life.');
    expect((result.shortcuts ?? [])[0].name).toBe('Add person');
  });

  it('prefers the locale cookie over Accept-Language', async () => {
    mocks.getLocaleFromCookie.mockResolvedValue('es-ES');
    mocks.detectBrowserLocale.mockResolvedValue('de-DE');

    const result = await manifest();

    expect(result.lang).toBe('es-ES');
    expect(result.description).toBe('Organiza a las personas de tu vida.');
    expect((result.shortcuts ?? [])[0].name).toBe('Añadir persona');
    expect(mocks.detectBrowserLocale).not.toHaveBeenCalled();
  });

  it('falls back to Accept-Language when there is no cookie', async () => {
    mocks.detectBrowserLocale.mockResolvedValue('ja-JP');

    const result = await manifest();

    expect(result.lang).toBe('ja-JP');
    expect(result.description).toBe('大切な人たちの情報を整理しましょう。');
  });

  it('translates the description in every supported locale', async () => {
    const seen = new Set<string>();

    for (const locale of SUPPORTED_LOCALES) {
      mocks.getLocaleFromCookie.mockResolvedValue(locale);
      const result = await manifest();

      expect(result.lang).toBe(locale);
      // A missing key would make getTranslationsForLocale return the key path.
      expect(result.description).not.toBe('description');
      expect(result.description).toBeTruthy();
      seen.add(result.description as string);
    }

    // Nine genuinely different strings, so nothing silently fell back.
    expect(seen.size).toBe(SUPPORTED_LOCALES.length);
  });
});
