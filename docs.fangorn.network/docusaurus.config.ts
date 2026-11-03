import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Fangorn Docs',
  tagline: 'Publish data once. People search it, agents call it, buyers pay for it.',
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

  markdown: {mermaid: true},
  themes: ['@docusaurus/theme-mermaid'],
  clientModules: ['./src/clientModules/d3-transition.ts'],

  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Figtree:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  ],

  presets: [
    [
      'classic',
      {
        // Docs live at the root; src/pages/index.tsx is the landing page.
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
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    mermaid: {
      theme: {light: 'base', dark: 'dark'},
      options: {
        fontFamily: 'Figtree, system-ui, sans-serif',
        themeVariables: {
          primaryColor: '#e5ede3',
          primaryBorderColor: '#2f7d55',
          primaryTextColor: '#17251e',
          lineColor: '#4c5f55',
          secondaryColor: '#f6f9f4',
          tertiaryColor: '#ffffff',
        },
      },
    },
    navbar: {
      title: 'Fangorn',
      logo: {alt: 'Fangorn', src: 'img/favicon.svg'},
      items: [
        {type: 'doc', docId: 'use-apps', label: 'Use', position: 'left'},
        {type: 'doc', docId: 'build-an-app', label: 'Build', position: 'left'},
        {type: 'doc', docId: 'sell-records', label: 'Sell', position: 'left'},
        {type: 'doc', docId: 'how-it-works', label: 'How it works', position: 'left'},
        {type: 'doc', docId: 'deploy', label: 'Operate', position: 'left'},
        {href: 'https://fangorn.network', label: 'fangorn.network', position: 'right'},
        {href: 'https://github.com/fangorn-network', label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Overview', to: '/intro'},
            {label: 'Use apps', to: '/use-apps'},
            {label: 'Build an app', to: '/build-an-app'},
            {label: 'Sell records', to: '/sell-records'},
          ],
        },
        {
          title: 'Network',
          items: [
            {label: 'How it works', to: '/how-it-works'},
            {label: 'Deploy Fangorn', to: '/deploy'},
            {label: 'App explorer', href: 'https://fangorn.network/#/explorer'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub', href: 'https://github.com/fangorn-network'},
            {label: 'Discord', href: 'https://discord.gg/JDj8RdCVyU'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Fangorn Network.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
