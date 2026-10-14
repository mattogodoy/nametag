import type { MetadataRoute } from 'next';
import { isSaasMode } from '@/lib/features';

// SAAS_MODE is read at request time, so one image serves both modes.
export const dynamic = 'force-dynamic';

/**
 * Self-hosted instances hold private data and should never show up in search,
 * so they block everything. The hosted service only exposes its sign-in and
 * sign-up pages; the marketing site at nametag.one does the rest.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isSaasMode()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: ['/login', '/register'],
      disallow: '/',
    },
  };
}
