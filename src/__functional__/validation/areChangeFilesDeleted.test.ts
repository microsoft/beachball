import { describe, expect, it, beforeAll, beforeEach, afterAll } from '@jest/globals';
import fs from 'fs-extra';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { Repository } from '../../__fixtures__/repository';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { BeachballOptions } from '../../types/BeachballOptions';
import { areChangeFilesDeleted } from '../../validation/areChangeFilesDeleted';
import { getChangePath } from '../../paths';

describe('areChangeFilesDeleted', () => {
  let repositoryFactory: RepositoryFactory;
  let repository: Repository;
  initMockLogs();

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory('single');
  });

  beforeEach(() => {
    repository = repositoryFactory.cloneRepository();
    generateChangeFiles(['pkg-1'], repository.rootPath);
    repository.push();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('is false when no change files are deleted', () => {
    repository.checkout('-b', 'feature-0');

    const result = areChangeFilesDeleted({
      branch: defaultRemoteBranchName,
      path: repository.rootPath,
    } as BeachballOptions);
    expect(result).toBeFalsy();
  });

  it('is true when change files are deleted', () => {
    repository.checkout('-b', 'feature-0');

    const changeDirPath = getChangePath(repository.rootPath);
    fs.removeSync(changeDirPath);

    repository.commitAll();

    const result = areChangeFilesDeleted({
      branch: defaultRemoteBranchName,
      path: repository.rootPath,
    } as BeachballOptions);
    expect(result).toBeTruthy();
  });

  it('deletes change files when changedir option is specified', () => {
    const testChangedir = 'changedir';
    generateChangeFiles(['pkg-1'], repository.rootPath, undefined, testChangedir);
    repository.push();
    repository.checkout('-b', 'feature-0');

    const changeDirPath = getChangePath(repository.rootPath, testChangedir);
    fs.removeSync(changeDirPath);

    repository.commitAll();

    const result = areChangeFilesDeleted({
      branch: defaultRemoteBranchName,
      path: repository.rootPath,
      changedir: testChangedir,
    } as BeachballOptions);
    expect(result).toBeTruthy();
  });
});
