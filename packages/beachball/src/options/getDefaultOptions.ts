import { env } from '../env';
import type { BeachballOptions } from '../types/BeachballOptions';

/**
 * Default options.
 */
export function getDefaultOptions(): BeachballOptions {
  return {
    authType: 'authtoken',
    branch: 'origin/master',
    bump: true,
    bumpDeps: true,
    changehint: 'Run "beachball change" to create a change file',
    changeDir: 'change',
    command: 'change',
    commit: true,
    concurrency: 1,
    defaultNpmTag: 'latest',
    fetch: true,
    generateChangelog: 'md',
    gitTags: true,
    npmReadConcurrency: env.npmConcurrency,
    path: '',
    publish: true,
    push: true,
    retries: 3,
    yes: env.isCI,
  };
}
