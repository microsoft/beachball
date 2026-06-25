import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import path from 'path';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { getRepoOptions } from '../../options/getRepoOptions';
import type { ParsedOptions, RepoOptions } from '../../types/BeachballOptions';

describe('getRepoOptions', () => {
  initMockLogs({ alsoLog: ['error', 'warn'] });

  let repositoryFactory: RepositoryFactory;
  // Don't reuse a repo in these tests! If multiple tests load beachball.config.js from the same path,
  // it will use the version from the require cache, which will have outdated contents.

  const cliOptions = (overrides: Partial<ParsedOptions['cliOptions']> = {}): ParsedOptions['cliOptions'] => ({
    command: 'stuff',
    ...overrides,
  });

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('returns empty object if path is not set', () => {
    expect(getRepoOptions(cliOptions())).toEqual({});
  });

  it('reads config from beachball.config.js', () => {
    const repo = repositoryFactory.cloneRepository();
    const repoOptions: Partial<RepoOptions> = { branch: 'origin/foo', access: 'public' };
    repo.writeFile('beachball.config.js', `module.exports = ${JSON.stringify(repoOptions)};`);

    expect(getRepoOptions(cliOptions({ path: repo.rootPath }))).toEqual(repoOptions);
  });

  it('reads config from package.json', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.updateJsonFile('package.json', { beachball: { branch: 'origin/foo' } });

    expect(getRepoOptions(cliOptions({ path: repo.rootPath }))).toEqual({ branch: 'origin/foo' });
  });

  it('finds a .beachballrc.json file', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.writeFile('.beachballrc.json', { branch: 'origin/foo' });

    expect(getRepoOptions(cliOptions({ path: repo.rootPath }))).toEqual({ branch: 'origin/foo' });
  });

  it('loads config from configPath', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.writeFile('beachball.config.js', 'module.exports = { branch: "origin/main" };');
    repo.writeFile('alternate.config.js', 'module.exports = { branch: "origin/foo" };');

    const repoOptions = getRepoOptions(cliOptions({ path: repo.rootPath, configPath: 'alternate.config.js' }));
    expect(repoOptions.branch).toEqual('origin/foo');
  });

  it('loads config from absolute configPath', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.writeFile('beachball.config.js', 'module.exports = { branch: "origin/main" };');
    repo.writeFile('nested/alternate.config.js', 'module.exports = { branch: "origin/foo" };');

    const repoOptions = getRepoOptions(
      cliOptions({ path: repo.rootPath, configPath: path.join(repo.rootPath, 'nested/alternate.config.js') })
    );
    expect(repoOptions.branch).toEqual('origin/foo');
  });

  it('throws if configPath could not be loaded', () => {
    const repo = repositoryFactory.cloneRepository();
    // An empty config file loads to an empty result, triggering the error.
    repo.writeFile('empty.config.js', '');

    expect(() => getRepoOptions(cliOptions({ path: repo.rootPath, configPath: 'empty.config.js' }))).toThrow(
      'Config file "empty.config.js" could not be loaded'
    );
  });

  it('resolves the default branch if no branch is specified', () => {
    const repo = repositoryFactory.cloneRepository();

    expect(getRepoOptions(cliOptions({ path: repo.rootPath }))).toEqual({ branch: defaultRemoteBranchName });
  });

  it('resolves the branch from config to include the remote', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.writeFile('beachball.config.js', 'module.exports = { branch: "master" };');

    expect(getRepoOptions(cliOptions({ path: repo.rootPath }))).toEqual({ branch: defaultRemoteBranchName });
  });

  it('does not modify the branch if specified in cliOptions', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.writeFile('beachball.config.js', 'module.exports = { branch: "origin/foo" };');

    expect(getRepoOptions(cliOptions({ path: repo.rootPath, branch: 'origin/bar' }))).toEqual({ branch: 'origin/foo' });
  });

  // this is logic from workspace-tools with the "strict" option
  it('throws if no remotes are defined', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.git(['remote', 'remove', 'origin']);

    expect(() => getRepoOptions(cliOptions({ path: repo.rootPath }))).toThrow(
      `No remotes defined in git repo at ${repo.rootPath}`
    );
  });

  // this is logic from workspace-tools with the "strict" option
  it('throws if no remote is found matching package.json repository', () => {
    const repo = repositoryFactory.cloneRepository();
    repo.updateJsonFile('package.json', { repository: { type: 'git', url: 'https://github.com/microsoft/nope.git' } });

    expect(() => getRepoOptions(cliOptions({ path: repo.rootPath }))).toThrow(
      'Could not find remote pointing to repository "microsoft/nope"'
    );
  });
});
