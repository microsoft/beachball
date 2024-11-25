import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { defaultRemoteBranchName, defaultRemoteName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { isChangeFileNeeded } from '../../validation/isChangeFileNeeded';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { getDefaultOptions } from '../../options/getDefaultOptions';

describe('isChangeFileNeeded', () => {
  let repositoryFactory: RepositoryFactory;
  let repository: Repository;
  initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      path: repository.rootPath,
      fetch: false,
      branch: defaultRemoteBranchName,
      ...options,
    };
  }

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  beforeEach(() => {
    repository = repositoryFactory.cloneRepository();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('is false when no changes have been made', () => {
    const result = isChangeFileNeeded(getOptions(), getPackageInfos(repository.rootPath));
    expect(result).toBeFalsy();
  });

  it('is true when changes exist in a new branch', () => {
    repository.checkout('-b', 'feature-0');
    repository.commitChange('myFilename');
    const result = isChangeFileNeeded(getOptions(), getPackageInfos(repository.rootPath));
    expect(result).toBeTruthy();
  });

  it('is false when changes are CHANGELOG files', () => {
    repository.checkout('-b', 'feature-0');
    repository.commitChange('CHANGELOG.md');
    const result = isChangeFileNeeded(getOptions(), getPackageInfos(repository.rootPath));
    expect(result).toBeFalsy();
  });

  it('throws if the remote is invalid', () => {
    // make a separate clone due to messing with the remote
    const repo = repositoryFactory.cloneRepository();
    repo.git(['remote', 'set-url', defaultRemoteName, 'file:///__nonexistent']);
    repo.checkout('-b', 'feature-0');
    repo.commitChange('fake.js');

    expect(() => {
      isChangeFileNeeded(getOptions({ path: repo.rootPath, fetch: true }), getPackageInfos(repo.rootPath));
    }).toThrow('Fetching branch "master" from remote "origin" failed');
  });
});
