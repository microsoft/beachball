module.exports = {
  title: 'beachball',
  description: 'The Sunniest Semantic Version Bumper',
  base: '/beachball/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/overview/getting-started' },
      { text: 'Github', link: 'https://github.com/microsoft/beachball' },
    ],
    sidebar: [
      {
        title: 'Overview',
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: ['/overview/installation', '/overview/getting-started', '/overview/configuration'],
      },
      {
        title: 'Concepts', // required
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: [
          '/concepts/bump-algorithm',
          '/concepts/change-files',
          '/concepts/ci-integration',
          '/concepts/groups',
        ],
      },
      {
        title: 'Command Line Args', // required
        collapsable: false, // optional, defaults to true
        sidebarDepth: 1, // optional, defaults to 1
        children: ['/cli/options', '/cli/bump', '/cli/change', '/cli/check', '/cli/publish', '/cli/sync'],
      },
    ],
  },
  plugins: [
    [
      'mermaidjs',
      {
        gantt: {
          barHeight: 20,
          fontSize: 12,
          useWidth: 960,
        },
      },
    ],
  ],
};
