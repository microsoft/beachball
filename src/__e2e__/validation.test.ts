import fs from 'fs-extra';
import { generateChangeFiles } from '../__fixtures__/changeFiles';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { RepositoryFactory, Repository } from '../__fixtures__/repository';
import { isChangeFileNeeded } from '../validation/isChangeFileNeeded';
import { BeachballOptions } from '../types/BeachballOptions';
import { areChangeFilesDeleted } from '../validation/areChangeFilesDeleted';
import { getChangePath } from '../paths';
import { getPackageInfos } from '../monorepo/getPackageInfos';

describe('validation', () => {
  let repositoryFactory: RepositoryFactory;
  initMockLogs();

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  describe('isChangeFileNeeded', () => {
    let repository: Repository;

    beforeEach(() => {
      repository = repositoryFactory.cloneRepository();
    });

    it('is false when no changes have been made', () => {
      const result = isChangeFileNeeded(
        {
          branch: 'origin/master',
          path: repository.rootPath,
          fetch: false,
        } as BeachballOptions,
        getPackageInfos(repository.rootPath)
      );
      expect(result).toBeFalsy();
    });

    it('is true when changes exist in a new branch', () => {
      repository.branch('feature-0');
      repository.commitChange('myFilename');
      const result = isChangeFileNeeded(
        {
          branch: 'origin/master',
          path: repository.rootPath,
          fetch: false,
        } as BeachballOptions,
        getPackageInfos(repository.rootPath)
      );
      expect(result).toBeTruthy();
    });

    it('is false when changes are CHANGELOG files', () => {
      repository.branch('feature-0');
      repository.commitChange('CHANGELOG.md');
      const result = isChangeFileNeeded(
        {
          branch: 'origin/master',
          path: repository.rootPath,
          fetch: false,
        } as BeachballOptions,
        getPackageInfos(repository.rootPath)
      );
      expect(result).toBeFalsy();
    });

    it('throws if the remote is invalid', () => {
      repository.setRemoteUrl('origin', 'file:///__nonexistent');
      repository.branch('feature-0');
      repository.commitChange('CHANGELOG.md');

      expect(() => {
        isChangeFileNeeded(
          {
            branch: 'origin/master',
            path: repository.rootPath,
            fetch: true,
          } as BeachballOptions,
          getPackageInfos(repository.rootPath)
        );
      }).toThrow();
    });
  });

  describe('areChangeFilesDeleted', () => {
    let repository: Repository;

    beforeEach(() => {
      repository = repositoryFactory.cloneRepository();
      generateChangeFiles(['pkg-1'], repository.rootPath);
      repository.push('origin', 'master');
    });

    it('is false when no change files are deleted', () => {
      repository.branch('feature-0');

      const result = areChangeFilesDeleted({
        branch: 'origin/master',
        path: repository.rootPath,
      } as BeachballOptions);
      expect(result).toBeFalsy();
    });

    it('is true when change files are deleted', () => {
      repository.branch('feature-0');

      const changeDirPath = getChangePath(repository.rootPath);
      fs.removeSync(changeDirPath);

      repository.commitAll();

      const result = areChangeFilesDeleted({
        branch: 'origin/master',
        path: repository.rootPath,
      } as BeachballOptions);
      expect(result).toBeTruthy();
    });
  });
});
