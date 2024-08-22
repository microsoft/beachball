import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';

import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { BeachballOptions } from '../../types/BeachballOptions';
import type { Repository } from '../../__fixtures__/repository';
import { getDefaultOptions } from '../../options/getDefaultOptions';

describe('readChangeFiles', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: RepositoryFactory;
  let repo: Repository | undefined;

  const logs = initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      ...options,
    };
  }

  beforeAll(() => {
    // These tests can share the same repo factories because they don't push to origin
    // (the actual tests run against a clone)
    repositoryFactory = new RepositoryFactory('single');
    monoRepoFactory = new RepositoryFactory('monorepo');
  });

  afterEach(() => {
    repo = undefined;
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    monoRepoFactory.cleanUp();
  });

  it('does not add commit hash', () => {
    repo = repositoryFactory.cloneRepository();
    repo.commitChange('foo');

    const options = getOptions();
    generateChangeFiles(['foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(changeSet[0].change.commit).toBe(undefined);
  });

  it('reads from a custom changeDir', () => {
    repo = repositoryFactory.cloneRepository();
    repo.commitChange('foo');

    const options = getOptions({ changeDir: 'changeDir' });
    generateChangeFiles(['foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
  });

  it('excludes invalid change files', () => {
    repo = monoRepoFactory.cloneRepository();
    repo.updateJsonFile('packages/bar/package.json', { private: true });
    const options = getOptions();

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes invalid changes from grouped change file in monorepo', () => {
    repo = monoRepoFactory.cloneRepository();
    repo.updateJsonFile('packages/bar/package.json', { private: true });

    const options = getOptions({ groupChanges: true });

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes out of scope change files in monorepo', () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({ scope: ['packages/foo'] });

    generateChangeFiles(['bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('excludes out of scope changes from grouped change file in monorepo', () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({ scope: ['packages/foo'], groupChanges: true });

    generateChangeFiles(['bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });
});
