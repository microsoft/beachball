// @ts-check
import { defineClientConfig } from 'vuepress/client';
import { defineMermaidConfig } from 'vuepress-plugin-md-enhance/client';

defineMermaidConfig({
  // This can use a CSS variable because text is rendered in HTML tags
  fontFamily: 'var(--font-family)',
  themeVariables: {
    // Background and border colors can't use CSS variables since they're rendered in SVG...
    mainBkg: '#fff5cc', // node background
    nodeBorder: '#cb9f0c',
    edgeLabelBackground: '#f8de87',
    // Some of these node colors are conditionally set in index.scss for dark mode...
    // titleColor: 'red', // sub-graph title
    // nodeTextColor: 'red', // yes
    // secondaryColor: 'red', // edgeLabelBackground default
    // tertiaryColor: 'red', // sub-graph backgrouns
    // tertiaryBorderColor: 'red', // sub-graph border
    // tertiaryTextColor: 'red', // sub-graph title
    // clusterBkg: 'red', // sub-graph background
    // clusterBorder: 'red', // sub-graph border
  },
  // some spacing options available under "flowchart"
});

export default defineClientConfig({
  enhance: context => {
    context.app.directive;
  },
});
