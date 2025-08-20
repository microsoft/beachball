import { viteBundler } from '@vuepress/bundler-vite';
import { markdownChartPlugin } from '@vuepress/plugin-markdown-chart';
import { searchPlugin } from '@vuepress/plugin-search';
import { defaultTheme } from '@vuepress/theme-default';
import { defineUserConfig } from 'vuepress';

export default defineUserConfig({
  title: 'beachball',
  description: 'The Sunniest Semantic Version Bumper',
  base: '/beachball/',
  bundler: viteBundler(),
  theme: defaultTheme({
    navbar: [
      { text: 'Home', link: '/' },
      { text: 'Getting started', link: '/overview/getting-started' },
      { text: 'GitHub', link: 'https://github.com/microsoft/beachball' },
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
        text: 'CLI commands',
        collapsible: false,
        children: ['/cli/options', '/cli/bump', '/cli/change', '/cli/check', '/cli/publish', '/cli/sync'],
      },
    ],
  }),
  plugins: [
    markdownChartPlugin({
      mermaid: true,
    }),
    searchPlugin(),
  ],
});
