// @ts-check
import { viteBundler } from '@vuepress/bundler-vite';
import { searchPlugin } from '@vuepress/plugin-search';
import { defaultTheme } from '@vuepress/theme-default';
import { defineUserConfig } from 'vuepress';
import { mdEnhancePlugin } from 'vuepress-plugin-md-enhance';

export default defineUserConfig({
  title: 'beachball',
  description: 'The Sunniest Semantic Version Bumper',
  base: '/beachball/',
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/overview/getting-started' },
      { text: 'Github', link: 'https://github.com/microsoft/beachball' },
    ],
    sidebar: [
      {
        text: 'Overview',
        collapsible: false,
        children: ['/overview/getting-started', '/overview/installation', '/overview/configuration'],
      },
      {
        text: 'Concepts',
        collapsible: false,
        children: [
          '/concepts/bump-algorithm',
          '/concepts/change-files',
          '/concepts/ci-integration',
          '/concepts/groups',
        ],
      },
      {
        text: 'Command Line Args',
        collapsible: false,
        children: ['/cli/options', '/cli/bump', '/cli/change', '/cli/check', '/cli/publish', '/cli/sync'],
      },
    ],
  }),
  plugins: [
    mdEnhancePlugin({
      mermaid: true,
    }),
    searchPlugin(),
  ],
});
