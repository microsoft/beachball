import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { defaultRemoteBranchName, defaultRemoteName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { isChangeFileNeeded } from '../../validation/isChangeFileNeeded';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { getParsedOptions } from '../../options/getOptions';

describe('isChangeFileNeeded', () => {
  let repositoryFactory: RepositoryFactory;
  let repository: Repository;
  initMockLogs();

  function getOptionsAndPackages(options?: Partial<BeachballOptions>, cwd?: string) {
    const parsedOptions = getParsedOptions({
      cwd: cwd ?? repository.rootPath,
      argv: [],
      testRepoOptions: {
        fetch: false,
        branch: defaultRemoteBranchName,
        ...options,
      },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    return { packageInfos, options: parsedOptions.options };
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
    const { packageInfos, options } = getOptionsAndPackages();
    const result = isChangeFileNeeded(options, packageInfos);
    expect(result).toBeFalsy();
  });

  it('is true when changes exist in a new branch', () => {
    repository.checkout('-b', 'feature-0');
    repository.commitChange('myFilename');
    const { packageInfos, options } = getOptionsAndPackages();
    const result = isChangeFileNeeded(options, packageInfos);
    expect(result).toBeTruthy();
  });

  it('is false when changes are CHANGELOG files', () => {
    repository.checkout('-b', 'feature-0');
    repository.commitChange('CHANGELOG.md');
    const { packageInfos, options } = getOptionsAndPackages();
    const result = isChangeFileNeeded(options, packageInfos);
    expect(result).toBeFalsy();
  });

  it('throws if the remote is invalid', () => {
    // make a separate clone due to messing with the remote
    const repo = repositoryFactory.cloneRepository();
    repo.git(['remote', 'set-url', defaultRemoteName, 'file:///__nonexistent']);
    repo.checkout('-b', 'feature-0');
    repo.commitChange('fake.js');

    const { packageInfos, options } = getOptionsAndPackages({ fetch: true }, repo.rootPath);

    expect(() => {
      isChangeFileNeeded(options, packageInfos);
    }).toThrow('Fetching branch "master" from remote "origin" failed');
  });
});
