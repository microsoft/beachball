import { BeachballOptions } from '../types/BeachballOptions';

export function getDefaultOptions(): Partial<BeachballOptions> {
  return {
    authType: 'authtoken',
    command: 'change',
    publish: true,
    bumpDeps: true,
    push: true,
    registry: 'https://registry.npmjs.org/',
    gitTags: true,
    access: 'restricted',
    changehint: 'Run "beachball change" to create a change file',
    fetch: true,
    defaultNpmTag: 'latest',
    retries: 3,
    bump: true,
    generateChangelog: true,
  };
}
