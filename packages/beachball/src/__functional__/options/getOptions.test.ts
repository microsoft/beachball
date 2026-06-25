import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getOptions, getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { getDefaultOptions } from '../../options/getDefaultOptions';

describe('getOptions (deprecated)', () => {
  initMockLogs({ alsoLog: ['error', 'warn'] });

  let repositoryFactory: RepositoryFactory;
  // Don't reuse a repo in these tests! If multiple tests load beachball.config.js from the same path,
  // it will use the version from the require cache, which will have outdated contents.

  const baseArgv = () => ['node', 'bin.js'];

  // The original getOptions relies on actual process.cwd(), so we have to set and restore it
  const cwd = process.cwd();

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterEach(() => {
    process.chdir(cwd);
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('uses the branch name defined in beachball.config.js', () => {
    const repo = repositoryFactory.cloneRepository();
    process.chdir(repo.rootPath);
    repo.writeFile('beachball.config.js', 'module.exports = { branch: "origin/foo" };');
    // eslint-disable-next-line @ms-cloudpack/no-deprecated
    const config = getOptions(baseArgv());
    expect(config).toEqual({ ...getDefaultOptions(), branch: 'origin/foo', path: repo.rootPath });
  });

  it('overrides repo options with CLI options', () => {
    const repo = repositoryFactory.cloneRepository();
    process.chdir(repo.rootPath);
    const repoOptions: Partial<RepoOptions> = { branch: 'origin/foo', bump: false };
    repo.writeFile('beachball.config.js', `module.exports = ${JSON.stringify(repoOptions)};`);
    // eslint-disable-next-line @ms-cloudpack/no-deprecated
    const config = getOptions([...baseArgv(), '--branch', 'origin/bar', '--bump']);
    expect(config).toEqual({
      ...getDefaultOptions(),
      ...repoOptions,
      branch: 'origin/bar',
      bump: true,
      path: repo.rootPath,
    });
  });
});

describe('getParsedOptions', () => {
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

    const parsedOptions = getParsedOptions({
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

    const parsedOptions = getParsedOptions({
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
