import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.nametag.one',
  integrations: [
    starlight({
      title: 'Nametag Docs',
      logo: {
        src: './src/assets/logo.svg',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/mattogodoy/nametag' },
        { icon: 'external', label: 'Nametag', href: 'https://nametag.one' },
      ],
      customCss: ['./src/styles/custom.css'],
      defaultLocale: 'root',
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Quick Tour', slug: 'getting-started/quick-tour' },
            { label: 'Core Concepts', slug: 'getting-started/core-concepts' },
          ],
        },
        {
          label: 'Features',
          items: [
            { label: 'People', slug: 'features/people' },
            { label: 'Groups', slug: 'features/groups' },
            { label: 'Relationships', slug: 'features/relationships' },
            { label: 'Network Graph', slug: 'features/network-graph' },
            { label: 'Journal', slug: 'features/journal' },
            { label: 'Map', slug: 'features/map' },
            { label: 'Important Dates', slug: 'features/important-dates' },
            { label: 'Contact Reminders', slug: 'features/contact-reminders' },
            { label: 'Photos', slug: 'features/photos' },
            { label: 'Custom Fields', slug: 'features/custom-fields' },
            { label: 'Search', slug: 'features/search' },
            { label: 'Import & Export', slug: 'features/import-export' },
            { label: 'Duplicate Detection', slug: 'features/duplicates' },
            { label: 'CardDAV Sync', slug: 'features/carddav' },
            { label: 'Trash & Restore', slug: 'features/trash' },
            { label: 'Settings', slug: 'features/settings' },
            { label: 'Bulk Actions', slug: 'features/bulk-actions' },
          ],
        },
        {
          label: 'Self-Hosting',
          items: [
            { label: 'Installation', slug: 'self-hosting/installation' },
            { label: 'Configuration', slug: 'self-hosting/configuration' },
            { label: 'Email Setup', slug: 'self-hosting/email' },
            { label: 'Authentication', slug: 'self-hosting/authentication' },
            { label: 'Redis', slug: 'self-hosting/redis' },
            { label: 'Reverse Proxy', slug: 'self-hosting/reverse-proxy' },
            { label: 'Map & Geocoding', slug: 'self-hosting/map-geocoding' },
            { label: 'Cron Jobs', slug: 'self-hosting/cron-jobs' },
            { label: 'Backups', slug: 'self-hosting/backups' },
            { label: 'Upgrading', slug: 'self-hosting/upgrading' },
            { label: 'Troubleshooting', slug: 'self-hosting/troubleshooting' },
          ],
        },
        {
          label: 'API Reference',
          items: [
            { label: 'Overview', slug: 'api/overview' },
            { label: 'API Tokens', slug: 'api/tokens' },
            { label: 'People', slug: 'api/people' },
            { label: 'Groups', slug: 'api/groups' },
            { label: 'Relationships', slug: 'api/relationships' },
            { label: 'Journal', slug: 'api/journal' },
            { label: 'Map', slug: 'api/map' },
            { label: 'Dashboard', slug: 'api/dashboard' },
            { label: 'CardDAV', slug: 'api/carddav' },
            { label: 'Import & Export', slug: 'api/import-export' },
            { label: 'User & Settings', slug: 'api/user' },
            { label: 'Webhooks', slug: 'api/webhooks' },
          ],
        },
        {
          label: 'Contributing',
          items: [
            { label: 'Development Setup', slug: 'contributing/development' },
            { label: 'Architecture', slug: 'contributing/architecture' },
            { label: 'Versioning', slug: 'contributing/versioning' },
            { label: 'Code Guidelines', slug: 'contributing/guidelines' },
          ],
        },
      ],
    }),
  ],
});
