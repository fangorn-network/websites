import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Fangorn Docs',
  tagline: 'Turn any dataset into an app for people and agents.',
  favicon: 'img/favicon.svg',

  future: {
    v4: true,
  },

  url: 'https://docs.fangorn.network',
  baseUrl: '/',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        // Docs are the whole site: no landing page, no blog.
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Fangorn',
      logo: {
        alt: 'Fangorn',
        src: 'img/favicon.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {href: 'https://fangorn.network/#/explorer', label: 'Apps', position: 'right'},
        {
          href: 'https://github.com/fangorn-network/westmarch',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Use Fangorn apps', to: '/use-apps'},
            {label: 'Build an app', to: '/build-an-app'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'fangorn.network', href: 'https://fangorn.network'},
            {label: 'GitHub', href: 'https://github.com/fangorn-network/westmarch'},
            {label: 'Discord', href: 'https://discord.gg/JDj8RdCVyU'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Fangorn Network.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
