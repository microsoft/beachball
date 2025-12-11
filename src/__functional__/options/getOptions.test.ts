import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getOptions, getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';

describe('getOptions (deprecated)', () => {
  let repositoryFactory: RepositoryFactory;
  // Don't reuse a repo in these tests! If multiple tests load beachball.config.js from the same path,
  // it will use the version from the require cache, which will have outdated contents.

  const baseArgv = () => ['node.exe', 'bin.js'];

  const inDirectory = <T>(directory: string, cb: () => T): T => {
    const originalDirectory = process.cwd();
    process.chdir(directory);
    try {
      return cb();
    } finally {
      process.chdir(originalDirectory);
    }
  };

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
      // eslint-disable-next-line etc/no-deprecated
      return getOptions(baseArgv());
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('reads config from package.json', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeJsonSync('package.json', { beachball: { branch: 'origin/foo' } });
      // eslint-disable-next-line etc/no-deprecated
      return getOptions(baseArgv());
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('finds a .beachballrc.json file', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeJsonSync('.beachballrc.json', { branch: 'origin/foo' });
      // eslint-disable-next-line etc/no-deprecated
      return getOptions(baseArgv());
    });
    expect(config.branch).toEqual('origin/foo');
  });

  it('--config overrides configuration path', () => {
    const repo = repositoryFactory.cloneRepository();
    const config = inDirectory(repo.rootPath, () => {
      fs.writeFileSync('beachball.config.js', 'module.exports = { branch: "origin/main" };');
      fs.writeFileSync('alternate.config.js', 'module.exports = { branch: "origin/foo" };');
      // eslint-disable-next-line etc/no-deprecated
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
      // eslint-disable-next-line etc/no-deprecated
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

describe('getParsedOptions', () => {
  let repositoryFactory: RepositoryFactory;
  // Don't reuse a repo in these tests! If multiple tests load beachball.config.js from the same path,
  // it will use the version from the require cache, which will have outdated contents.

  // Return a new object each time since getRepoOptions caches the result based on object identity.
  const baseArgv = () => ['node', 'beachball', 'stuff'];

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
    const repoOptions: Partial<RepoOptions> = { branch: 'origin/foo' };
    fs.writeFileSync(
      path.join(repo.rootPath, 'beachball.config.js'),
      `module.exports = ${JSON.stringify(repoOptions)};`
    );

    const parsedOptions = getParsedOptions({ argv: baseArgv(), cwd: repo.rootPath });
    expect(parsedOptions).toEqual({
      options: expect.objectContaining({ branch: 'origin/foo' }),
      repoOptions: { branch: 'origin/foo' },
      cliOptions: { path: repo.rootPath, command: 'stuff' },
    });
  });

  it('reads config from package.json', () => {
    const repo = repositoryFactory.cloneRepository();
    fs.writeJsonSync(path.join(repo.rootPath, 'package.json'), { beachball: { branch: 'origin/foo' } });

    const parsedOptions = getParsedOptions({ argv: baseArgv(), cwd: repo.rootPath });
    expect(parsedOptions).toEqual({
      options: expect.objectContaining({ branch: 'origin/foo' }),
      repoOptions: { branch: 'origin/foo' },
      cliOptions: { path: repo.rootPath, command: 'stuff' },
    });
  });

  it('finds a .beachballrc.json file', () => {
    const repo = repositoryFactory.cloneRepository();
    fs.writeJsonSync(path.join(repo.rootPath, '.beachballrc.json'), { branch: 'origin/foo' });

    const parsedOptions = getParsedOptions({ argv: baseArgv(), cwd: repo.rootPath });
    expect(parsedOptions.options.branch).toEqual('origin/foo');
  });

  it('--config overrides configuration path', () => {
    const repo = repositoryFactory.cloneRepository();
    fs.writeFileSync(path.join(repo.rootPath, 'beachball.config.js'), 'module.exports = { branch: "origin/main" };');
    fs.writeFileSync(path.join(repo.rootPath, 'alternate.config.js'), 'module.exports = { branch: "origin/foo" };');

    const parsedOptions = getParsedOptions({
      argv: [...baseArgv(), '--config', 'alternate.config.js'],
      cwd: repo.rootPath,
    });
    expect(parsedOptions.options.branch).toEqual('origin/foo');
  });

  it('overrides repo options with CLI options', () => {
    const repo = repositoryFactory.cloneRepository();
    const repoOptions: Partial<RepoOptions> = { branch: 'origin/foo' };
    fs.writeFileSync(
      path.join(repo.rootPath, 'beachball.config.js'),
      `module.exports = ${JSON.stringify(repoOptions)};`
    );

    const parsedOptions = getParsedOptions({
      argv: [...baseArgv(), '--branch', 'origin/bar'],
      cwd: repo.rootPath,
    });
    expect(parsedOptions).toEqual({
      options: expect.objectContaining({ branch: 'origin/bar' }),
      repoOptions: { branch: 'origin/foo' },
      cliOptions: { path: repo.rootPath, command: 'stuff', branch: 'origin/bar' },
    });
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
    fs.writeFileSync(
      path.join(repo.rootPath, 'beachball.config.js'),
      `module.exports = ${JSON.stringify(repoOptions)};`
    );

    const parsedOptions = getParsedOptions({
      argv: [...baseArgv(), '--disallowed-change-types', 'patch'],
      cwd: repo.rootPath,
    });
    expect(parsedOptions.options).toMatchObject({
      access: 'public',
      publish: false,
      disallowedChangeTypes: ['patch'],
    });
    expect(parsedOptions.options.changelog).toEqual(repoOptions.changelog);
  });
});
