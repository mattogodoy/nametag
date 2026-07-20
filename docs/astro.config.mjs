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
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'Features',
          autogenerate: { directory: 'features' },
        },
        {
          label: 'Self-Hosting',
          autogenerate: { directory: 'self-hosting' },
        },
        {
          label: 'API Reference',
          autogenerate: { directory: 'api' },
        },
        {
          label: 'Contributing',
          autogenerate: { directory: 'contributing' },
        },
      ],
    }),
  ],
});
