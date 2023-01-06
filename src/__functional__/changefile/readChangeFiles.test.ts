import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import _ from 'lodash';

import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { BeachballOptions } from '../../types/BeachballOptions';

describe('readChangeFiles', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: RepositoryFactory;

  const logs = initMockLogs();

  beforeAll(() => {
    // These tests can share the same repo factories because they don't push to origin
    // (the actual tests run against a clone)
    repositoryFactory = new RepositoryFactory('single');
    monoRepoFactory = new RepositoryFactory('monorepo');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    monoRepoFactory.cleanUp();
  });

  it('does not add commit hash', () => {
    const repository = repositoryFactory.cloneRepository();
    repository.commitChange('foo');
    generateChangeFiles(['foo'], repository.rootPath);

    const packageInfos = getPackageInfos(repository.rootPath);
    const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(changeSet[0].change.commit).toBe(undefined);
  });

  it('excludes invalid change files', () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.updateJsonFile('packages/bar/package.json', { private: true });
    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], monoRepo.rootPath);

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changeSet = readChangeFiles({ path: monoRepo.rootPath } as BeachballOptions, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes invalid changes from grouped change file', () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.updateJsonFile('packages/bar/package.json', { private: true });
    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], monoRepo.rootPath, true /*groupChanges*/);

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changeSet = readChangeFiles(
      { path: monoRepo.rootPath, groupChanges: true } as BeachballOptions,
      packageInfos
    );
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes out of scope change files', () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    generateChangeFiles(['bar', 'foo'], monoRepo.rootPath);

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changeSet = readChangeFiles(
      { path: monoRepo.rootPath, scope: ['packages/foo'] } as BeachballOptions,
      packageInfos
    );
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('excludes out of scope changes from grouped change file', () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    generateChangeFiles(['bar', 'foo'], monoRepo.rootPath, true /*groupChanges*/);

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changeSet = readChangeFiles(
      { path: monoRepo.rootPath, scope: ['packages/foo'], groupChanges: true } as BeachballOptions,
      packageInfos
    );
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });
});
