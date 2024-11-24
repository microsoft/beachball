import { env } from '../env';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Default options.
 */
export function getDefaultOptions(): BeachballOptions {
  return {
    access: 'restricted',
    all: false,
    authType: 'authtoken',
    branch: 'origin/master',
    bump: true,
    bumpDeps: true,
    canaryName: undefined,
    changehint: 'Run "beachball change" to create a change file',
    changeDir: 'change',
    command: 'change',
    commit: true,
    concurrency: 1,
    defaultNpmTag: 'latest',
    depth: undefined,
    disallowedChangeTypes: null,
    fetch: true,
    generateChangelog: 'md',
    gitTags: true,
    gitTimeout: undefined,
    message: '',
    new: false,
    path: '',
    publish: true,
    push: true,
    registry: 'https://registry.npmjs.org/',
    retries: 3,
    scope: null,
    tag: '',
    timeout: undefined,
    type: null,
    version: false,
    yes: env.isCI,
  };
}
