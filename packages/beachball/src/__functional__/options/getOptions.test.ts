import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { getDefaultOptions } from '../../options/getDefaultOptions';

describe('getOptions', () => {
  initMockLogs({ alsoLog: ['error', 'warn'] });

  let repositoryFactory: RepositoryFactory;
  // Don't reuse a repo in these tests! If multiple tests load beachball.config.js from the same path,
  // it will use the version from the require cache, which will have outdated contents.

  // Return a new object each time since getRepoOptions caches the result based on object identity.
  const baseArgv = () => ['node', 'beachball', 'stuff'];

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('--config overrides configuration path', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.writeFile('beachball.config.js', 'module.exports = { branch: "origin/main" };');
    repo.writeFile('alternate.config.js', 'module.exports = { branch: "origin/foo" };');

    const parsedOptions = getOptions({
      argv: [...baseArgv(), '--config', 'alternate.config.js'],
      env: {},
      cwd: repo.rootPath,
    });
    expect(parsedOptions.options.branch).toEqual('origin/foo');
  });

  it('overrides repo options with CLI options', () => {
    const repo = repositoryFactory.cloneRepository();
    const repoOptions: Partial<RepoOptions> = { branch: 'origin/foo', bump: false };
    repo.writeFile('beachball.config.js', `module.exports = ${JSON.stringify(repoOptions)};`);

    const parsedOptions = getOptions({
      argv: [...baseArgv(), '--branch', 'origin/bar', '--bump'],
      cwd: repo.rootPath,
      env: {},
    });
    expect(parsedOptions).toEqual({
      options: {
        ...getDefaultOptions(),
        ...repoOptions,
        branch: 'origin/bar',
        bump: true,
        command: 'stuff',
        path: repo.rootPath,
      },
      repoOptions,
      cliOptions: { path: repo.rootPath, command: 'stuff', branch: 'origin/bar', bump: true },
    });
  });
});
