import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { BeachballOptions } from '../../types/BeachballOptions';
import { areChangeFilesDeleted } from '../../validation/areChangeFilesDeleted';
import { getChangePath } from '../../paths';

describe('areChangeFilesDeleted', () => {
  const factory = new RepositoryFactory('single');
  initMockLogs();

  beforeAll(() => {
    factory.init();
    generateChangeFiles(['pkg-1'], factory.defaultRepo.rootPath);
    factory.defaultRepo.push();
  });

  afterEach(() => {
    factory.defaultRepo.resetFromOrigin();
  });

  afterAll(() => {
    factory.cleanUp();
  });

  it('is false when no change files are deleted', () => {
    const repository = factory.defaultRepo;
    repository.checkout('-b', 'feature-0');

    const result = areChangeFilesDeleted({
      branch: defaultRemoteBranchName,
      path: repository.rootPath,
    } as BeachballOptions);
    expect(result).toBeFalsy();
  });

  it('is true when change files are deleted', () => {
    const repository = factory.defaultRepo;
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
});
