import { BeachballOptions } from '../types/BeachballOptions';

export function getDefaultOptions() {
  return {
    all: false,
    authType: 'authtoken',
    branch: 'origin/master',
    command: 'change',
    message: '',
    publish: true,
    bumpDeps: true,
    push: true,
    registry: 'https://registry.npmjs.org/',
    token: '',
    gitTags: true,
    tag: '',
    yes: false,
    access: 'restricted',
    package: '',
    changehint: 'Run "beachball change" to create a change file',
    type: null,
    fetch: true,
    version: false,
    disallowedChangeTypes: null,
    defaultNpmTag: 'latest',
    scope: null,
    retries: 3,
    timeout: undefined,
    bump: true,
    canaryName: undefined,
    generateChangelog: true,
    depth: undefined,
  } as BeachballOptions;
}
