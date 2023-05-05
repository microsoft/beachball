import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { defaultRemoteBranchName, defaultRemoteName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { isChangeFileNeeded } from '../../validation/isChangeFileNeeded';
import { BeachballOptions } from '../../types/BeachballOptions';
import { getPackageInfos } from '../../monorepo/getPackageInfos';

describe('isChangeFileNeeded', () => {
  const factory = new RepositoryFactory('single');
  initMockLogs();

  beforeAll(() => {
    factory.init();
  });

  beforeEach(() => {
    factory.reset();
  });

  afterAll(() => {
    factory.cleanUp();
  });

  it('is false when no changes have been made', () => {
    const repository = factory.defaultRepo;
    const result = isChangeFileNeeded(
      {
        branch: defaultRemoteBranchName,
        path: repository.rootPath,
        fetch: false,
      } as BeachballOptions,
      getPackageInfos(repository.rootPath)
    );
    expect(result).toBeFalsy();
  });

  it('is true when changes exist in a new branch', () => {
    const repository = factory.defaultRepo;
    repository.checkout('-b', 'feature-0');
    repository.commitChange('myFilename');
    const result = isChangeFileNeeded(
      {
        branch: defaultRemoteBranchName,
        path: repository.rootPath,
        fetch: false,
      } as BeachballOptions,
      getPackageInfos(repository.rootPath)
    );
    expect(result).toBeTruthy();
  });

  it('is false when changes are CHANGELOG files', () => {
    const repository = factory.defaultRepo;
    repository.checkout('-b', 'feature-0');
    repository.commitChange('CHANGELOG.md');
    const result = isChangeFileNeeded(
      {
        branch: defaultRemoteBranchName,
        path: repository.rootPath,
        fetch: false,
      } as BeachballOptions,
      getPackageInfos(repository.rootPath)
    );
    expect(result).toBeFalsy();
  });

  it('throws if the remote is invalid', () => {
    // make a separate clone due to messing with the remote
    const repo = factory.cloneRepository();
    repo.git(['remote', 'set-url', defaultRemoteName, 'file:///__nonexistent']);
    repo.checkout('-b', 'feature-0');
    repo.commitChange('CHANGELOG.md');

    expect(() => {
      isChangeFileNeeded(
        {
          branch: defaultRemoteBranchName,
          path: repo.rootPath,
          fetch: true,
        } as BeachballOptions,
        getPackageInfos(repo.rootPath)
      );
    }).toThrow();
  });
});
