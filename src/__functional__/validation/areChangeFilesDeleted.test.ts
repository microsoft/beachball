import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs-extra';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { areChangeFilesDeleted } from '../../validation/areChangeFilesDeleted';
import { getChangePath } from '../../paths';
import { getDefaultOptions } from '../../options/getDefaultOptions';

describe('areChangeFilesDeleted', () => {
  let repositoryFactory: RepositoryFactory;
  let repository: Repository;
  initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      branch: defaultRemoteBranchName,
      path: repository.rootPath,
      ...options,
    };
  }

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  beforeEach(() => {
    repository = repositoryFactory.cloneRepository();
    generateChangeFiles(['pkg-1'], getOptions());
    repository.push();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('is false when no change files are deleted', () => {
    repository.checkout('-b', 'feature-0');

    const result = areChangeFilesDeleted(getOptions());
    expect(result).toBeFalsy();
  });

  it('is true when change files are deleted', () => {
    repository.checkout('-b', 'feature-0');

    const options = getOptions();
    const changeDirPath = getChangePath(options);
    fs.removeSync(changeDirPath);

    repository.commitAll();

    const result = areChangeFilesDeleted(options);
    expect(result).toBeTruthy();
  });

  it('deletes change files when changeDir option is specified', () => {
    const testChangedir = 'changeDir';
    const options = getOptions({ changeDir: testChangedir });

    generateChangeFiles(['pkg-1'], options);
    repository.push();
    repository.checkout('-b', 'feature-0');

    const changeDirPath = getChangePath(options);
    fs.removeSync(changeDirPath);

    repository.commitAll();

    const result = areChangeFilesDeleted(options);
    expect(result).toBeTruthy();
  });
});
