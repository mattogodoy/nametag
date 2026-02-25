import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  devIndicators: false,

  // Externalize Pino from Next.js webpack bundle (uses Node.js native modules)
  serverExternalPackages: ['pino', 'pino-pretty'],

  // Production optimization
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  // Security headers
  async headers() {
    const securityHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY', // Prevents clickjacking attacks
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff', // Prevents MIME type sniffing
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()', // Disable unnecessary browser features
      },
      {
        key: 'X-XSS-Protection',
        value: '1; mode=block', // Legacy XSS protection
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains', // Enforce HTTPS
      },
    ];

    // IMPORTANT: Order matters — Next.js uses last-match-wins for duplicate
    // header keys, so route-specific overrides (e.g. /api/docs CSP) must
    // come AFTER the catch-all rule.
    return [
      {
        source: '/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // TODO: Remove unsafe-inline and unsafe-eval in production
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      {
        source: '/api/docs',
        headers: [
          ...securityHeaders,
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://unpkg.com",
              "style-src 'self' 'unsafe-inline' https://unpkg.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
