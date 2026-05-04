import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  devIndicators: false,

  // Externalize Pino from Next.js webpack bundle (uses Node.js native modules)
  serverExternalPackages: ['pino', 'pino-pretty'],

  // Production optimization
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // Next 16's default proxyClientMaxBodySize is 10MB. Bodies larger than the
  // limit are silently truncated, which breaks multipart parsing for photo
  // uploads from high-resolution sources. Raise to match our 50MB upload cap.
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },

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
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()', // Disable unnecessary browser features
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
              // Next.js requires 'unsafe-inline' for hydration scripts.
              // Turbopack dev server also requires 'unsafe-eval' for HMR — only added in development.
              // Nonce-based CSP is the proper long-term solution.
              // See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              `connect-src 'self'${process.env.NODE_ENV === 'development' ? ' ws://localhost:*' : ''}`,
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
              "img-src 'self' data: blob: https:",
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
