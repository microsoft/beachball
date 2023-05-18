import { env } from '../env';
import { BeachballOptions } from '../types/BeachballOptions';

export function getDefaultOptions() {
  return {
    access: 'restricted',
    all: false,
    authType: 'authtoken',
    branch: 'origin/master',
    bump: true,
    bumpDeps: true,
    canaryName: undefined,
    changehint: 'Run "beachball change" to create a change file',
    command: 'change',
    defaultNpmTag: 'latest',
    depth: undefined,
    disallowedChangeTypes: null,
    fetch: true,
    generateChangelog: true,
    gitTags: true,
    gitTimeout: undefined,
    message: '',
    publish: true,
    push: true,
    registry: 'https://registry.npmjs.org/',
    retries: 3,
    scope: null,
    tag: '',
    timeout: undefined,
    token: '',
    type: null,
    version: false,
    yes: env.isCI,
  } as BeachballOptions;
}
