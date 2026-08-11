import { viteBundler } from '@vuepress/bundler-vite';
import { markdownChartPlugin } from '@vuepress/plugin-markdown-chart';
import { redirectPlugin } from '@vuepress/plugin-redirect';
import { searchPlugin } from '@vuepress/plugin-search';
import { defaultTheme } from '@vuepress/theme-default';
import path from 'node:path';
import { defineUserConfig } from 'vuepress';

export default defineUserConfig({
  title: 'beachball',
  description: 'The Sunniest Semantic Version Bumper',
  base: '/beachball/',
  bundler: viteBundler(),
  theme: defaultTheme({
    contributors: false, // don't show contributors on each page
    navbar: [
      {
        text: 'Versions',
        children: [
          { text: 'v3 prerelease', link: '/' },
          { text: 'v2 stable', link: '/v2/' },
        ],
      },
      { text: 'GitHub', link: 'https://github.com/microsoft/beachball' },
    ],
    sidebar: {
      '/v2/': [
        {
          text: 'Overview',
          collapsible: false,
          children: ['/v2/overview/getting-started', '/v2/overview/installation', '/v2/overview/configuration'],
        },
        {
          text: 'Concepts',
          collapsible: false,
          children: [
            '/v2/concepts/bump-algorithm',
            '/v2/concepts/change-files',
            '/v2/concepts/change-types',
            '/v2/concepts/groups',
            '/v2/concepts/ci-integration',
            '/v2/concepts/ai-integration',
            '/v2/concepts/large-repos',
          ],
        },
        {
          text: 'CLI commands',
          collapsible: false,
          children: [
            '/v2/cli/options',
            '/v2/cli/bump',
            '/v2/cli/change',
            '/v2/cli/check',
            '/v2/cli/config',
            '/v2/cli/publish',
            '/v2/cli/sync',
          ],
        },
      ],
      '/': [
        {
          text: 'Overview',
          collapsible: false,
          children: [
            '/overview/getting-started',
            '/overview/installation',
            '/overview/configuration',
            '/overview/v3-migration',
          ],
        },
        {
          text: 'Concepts',
          collapsible: false,
          children: [
            '/concepts/bump-algorithm',
            '/concepts/change-files',
            '/concepts/change-types',
            '/concepts/groups',
            {
              text: 'CI integration',
              link: '/concepts/ci-integration',
              collapsible: true,
              children: ['/concepts/ci-integration/auth-helper'],
            },
            '/concepts/ai-integration',
            '/concepts/large-repos',
          ],
        },
        {
          text: 'CLI commands',
          collapsible: false,
          children: [
            '/cli/options',
            '/cli/bump',
            '/cli/change',
            '/cli/check',
            '/cli/config',
            '/cli/migrate',
            '/cli/publish',
            '/cli/sync',
          ],
        },
      ],
    },
  }),
  plugins: [
    {
      name: 'version-aware-navbar',
      define: {
        __V3_ONLY_PATHS__: [
          '/overview/v3-migration.html',
          '/cli/migrate.html',
          '/concepts/ci-integration/auth-helper.html',
        ],
      },
      alias: {
        '@theme/useNavbarConfig': path.resolve(import.meta.dirname, 'composables/useNavbarConfig.ts'),
      },
    },
    markdownChartPlugin({
      mermaid: true,
    }),
    redirectPlugin({
      config: {
        // convenience redirects
        '/cli': '/cli/options',
        '/config': '/overview/configuration',
        '/overview/config': '/overview/configuration',
      },
    }),
    searchPlugin({
      isSearchable: page => !page.path.startsWith('/v2/'),
    }),
  ],
});
