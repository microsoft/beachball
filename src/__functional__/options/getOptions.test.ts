import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs-extra';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';

// Return a new object each time since getRepoOptions caches the result based on object identity.
const baseArgv = () => ['node.exe', 'bin.js'];

describe('getOptions', () => {
  let repositoryFactory: RepositoryFactory;
  // Don't reuse a repo in these tests! If multiple tests load beachball.config.js from the same path,
  // it will use the version from the require cache, which will have outdated contents.

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    jest.restoreAllMocks();
  });

  it('uses the branch name defined in beachball.config.js', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeFileSync('beachball.config.js', 'module.exports = { branch: "origin/foo" };');
      return getOptions(baseArgv());
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('reads config from package.json', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeJsonSync('package.json', { beachball: { branch: 'origin/foo' } });
      return getOptions(baseArgv());
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('finds a .beachballrc.json file', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeJsonSync('.beachballrc.json', { branch: 'origin/foo' });
      return getOptions(baseArgv());
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('--config overrides configuration path', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeFileSync('beachball.config.js', 'module.exports = { branch: "origin/main" };');
      fs.writeFileSync('alternate.config.js', 'module.exports = { branch: "origin/foo" };');
      return getOptions([...baseArgv(), '--config', 'alternate.config.js']);
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('merges options including objects', () => {
    const repo = repositoryFactory.cloneRepository();
    // Ideally this test should include nested objects from multiple sources, but as of writing,
    // the only place that can have nested objects is the repo options.
    const repoOptions: Partial<RepoOptions> = {
      access: 'public',
      publish: false,
      disallowedChangeTypes: null,
      changelog: {
        groups: [{ mainPackageName: 'foo', include: ['foo'], changelogPath: '.' }],
      },
    };
    const config = inDirectory(repo.rootPath, () => {
      fs.writeFileSync('beachball.config.js', `module.exports = ${JSON.stringify(repoOptions)};`);
      return getOptions([...baseArgv(), '--disallowed-change-types', 'patch']);
    });
    expect(config).toMatchObject({
      access: 'public',
      publish: false,
      disallowedChangeTypes: ['patch'],
    });
    expect(config.changelog).toEqual(repoOptions.changelog);
  });
});

const inDirectory = <T>(directory: string, cb: () => T): T => {
  const originalDirectory = process.cwd();
  process.chdir(directory);
  try {
    return cb();
  } finally {
    process.chdir(originalDirectory);
  }
};
