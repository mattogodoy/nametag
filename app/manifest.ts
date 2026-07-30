import type { MetadataRoute } from 'next';
import { getTranslationsForLocale } from '@/lib/i18n-utils';
import {
  detectBrowserLocale,
  getLocaleFromCookie,
  type SupportedLocale,
} from '@/lib/locale';

/**
 * Reading the locale cookie makes this route dynamic, which is the Next.js 16
 * default anyway.
 *
 * Caveat: browsers often request the manifest without cookies, so in practice
 * this usually resolves via Accept-Language rather than the user's saved
 * preference. Fixing that would need crossorigin="use-credentials" on the
 * manifest link, which Next.js metadata does not expose.
 */
async function resolveLocale(): Promise<SupportedLocale> {
  const fromCookie = await getLocaleFromCookie();
  if (fromCookie) {
    return fromCookie;
  }
  return detectBrowserLocale();
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await resolveLocale();
  const t = await getTranslationsForLocale(locale, 'pwa');

  return {
    id: '/',
    // Not translated: Nametag is a proper noun.
    name: 'Nametag',
    short_name: 'Nametag',
    description: t('description'),
    // '/' lets app/page.tsx redirect to /dashboard or /login based on session,
    // so a cold launch by a logged-out user behaves correctly.
    start_url: '/',
    display: 'standalone',
    // Baked in at install time, so it cannot follow the per-user theme. Uses
    // the dark value because dark is the app default.
    background_color: '#121110',
    theme_color: '#121110',
    lang: locale,
    dir: 'ltr',
    categories: ['productivity', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      // 1024: Android draws the splash screen icon at more device pixels than
      // 512 on high density screens, so without this Chrome upscales the 512
      // asset and it looks pixelated. The maskable variant needs it even more,
      // since its safe zone padding and Android's own crop already throw away
      // a chunk of the source resolution before any upscaling happens.
      { src: '/icons/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'maskable' },
    ],
    // Android and desktop long-press menu. Ignored by iOS.
    shortcuts: [
      { name: t('shortcuts.addPerson'), url: '/people/new' },
      { name: t('shortcuts.search'), url: '/people' },
      { name: t('shortcuts.dashboard'), url: '/dashboard' },
    ],
  };
}
