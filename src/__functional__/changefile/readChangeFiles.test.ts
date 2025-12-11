import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { generateChangeFiles, getChangeFiles } from '../../__fixtures__/changeFiles';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import type { RepoOptions } from '../../types/BeachballOptions';
import type { Repository } from '../../__fixtures__/repository';
import type { ChangeInfo } from '../../types/ChangeInfo';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { getParsedOptions } from '../../options/getOptions';
import { removeTempDir } from '../../__fixtures__/tmpdir';
import path from 'path';
import { createTestFileStructureType } from '../../__fixtures__/createTestFileStructure';

describe('readChangeFiles', () => {
  /** Non-git temp directory root, for tests that don't need git */
  let tempRoot: string | undefined;

  const logs = initMockLogs();

  function getOptionsAndPackages(repoOptions?: Partial<RepoOptions>) {
    const cwd = repoOptions?.path || tempRoot;
    expect(cwd).toBeTruthy();
    const parsedOptions = getParsedOptions({
      cwd: cwd!,
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName, ...repoOptions },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    return { packageInfos, options: parsedOptions.options, parsedOptions };
  }

  function updateJsonFile(relativePath: string, json: Record<string, unknown>) {
    const fullPath = path.join(tempRoot!, relativePath);
    const diskJson = fs.readJSONSync(fullPath) as Record<string, unknown>;
    Object.assign(diskJson, json);
    fs.writeJSONSync(fullPath, diskJson, { spaces: 2 });
  }

  afterEach(() => {
    tempRoot && removeTempDir(tempRoot);
    tempRoot = undefined;
  });

  it('reads change files and returns in reverse chronological order', async () => {
    // this test doesn't need git
    tempRoot = createTestFileStructureType('monorepo');
    const { options, packageInfos } = getOptionsAndPackages();

    generateChangeFiles(['bar'], options);
    // Wait slightly to ensure the mtime is different for sorting
    await new Promise(resolve => setTimeout(resolve, 5));
    generateChangeFiles(['foo'], options);

    // Include a basic check reading from disk to verify generateChangeFiles worked
    expect(getChangeFiles(options)).toHaveLength(2);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(2);
    expect(changeSet).toEqual([
      // foo will be first since it's newer
      {
        change: {
          comment: 'foo comment',
          dependentChangeType: 'patch',
          email: 'test@test.com',
          packageName: 'foo',
          type: 'minor',
        },
        changeFile: expect.stringMatching(/^foo-[\w-]+\.json$/),
      },
      {
        change: {
          comment: 'bar comment',
          dependentChangeType: 'patch',
          email: 'test@test.com',
          packageName: 'bar',
          type: 'minor',
        },
        changeFile: expect.stringMatching(/^bar-[\w-]+\.json$/),
      },
    ]);
  });

  it('reads from a custom changeDir', () => {
    tempRoot = createTestFileStructureType('monorepo');
    const { options, packageInfos } = getOptionsAndPackages({ changeDir: 'changeDir' });
    generateChangeFiles(['foo'], options);
    expect(getChangeFiles(options)).toHaveLength(1);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
  });

  it('reads a grouped change file', () => {
    tempRoot = createTestFileStructureType('monorepo');
    const { options, packageInfos } = getOptionsAndPackages({ groupChanges: true });

    generateChangeFiles(['foo', 'bar'], options);
    expect(getChangeFiles(options)).toHaveLength(1);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(2);

    const packageNames = changeSet.map(changeEntry => changeEntry.change.packageName).sort();
    expect(packageNames).toEqual(['bar', 'foo']);
  });

  it('excludes invalid change files', () => {
    tempRoot = createTestFileStructureType('monorepo');
    updateJsonFile('packages/bar/package.json', { private: true });

    const { options, packageInfos } = getOptionsAndPackages();

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);
    expect(getChangeFiles(options)).toHaveLength(3);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes invalid changes from grouped change file in monorepo', () => {
    tempRoot = createTestFileStructureType('monorepo');
    updateJsonFile('packages/bar/package.json', { private: true });

    const { options, packageInfos } = getOptionsAndPackages({ groupChanges: true });

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);
    expect(getChangeFiles(options)).toHaveLength(1);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes out of scope change files in monorepo', () => {
    tempRoot = createTestFileStructureType('monorepo');
    const { options, packageInfos } = getOptionsAndPackages({ scope: ['packages/foo'] });

    generateChangeFiles(['bar', 'foo'], options);
    expect(getChangeFiles(options)).toHaveLength(2);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('excludes out of scope changes from grouped change file in monorepo', () => {
    tempRoot = createTestFileStructureType('monorepo');
    const { options, packageInfos } = getOptionsAndPackages({ scope: ['packages/foo'], groupChanges: true });

    generateChangeFiles(['bar', 'foo'], options);
    expect(getChangeFiles(options)).toHaveLength(1);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('runs transform.changeFiles functions if provided', () => {
    const editedComment = 'Edited comment for testing';
    tempRoot = createTestFileStructureType('monorepo');

    const { options, packageInfos } = getOptionsAndPackages({
      transform: {
        changeFiles: (changeFile, changeFilePath, { command }) => {
          // For test, we will be changing the comment based on the package name
          if ((changeFile as ChangeInfo).packageName === 'foo') {
            (changeFile as ChangeInfo).comment = editedComment;
            (changeFile as ChangeInfo).command = command;
          }
          return changeFile as ChangeInfo;
        },
      },
      changelog: {
        groups: [
          {
            mainPackageName: 'foo',
            changelogPath: path.join(tempRoot, 'packages/foo'),
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    });

    generateChangeFiles([{ packageName: 'foo', comment: 'comment 1' }], options);
    generateChangeFiles([{ packageName: 'bar', comment: 'comment 2' }], options);

    const changes = readChangeFiles(options, packageInfos);

    // Verify that the comment of only the intended change file is changed
    for (const { change, changeFile } of changes) {
      if (changeFile.startsWith('foo')) {
        expect(change.comment).toBe(editedComment);
        expect(change.command).toEqual('change');
      } else {
        expect(change.comment).toBe('comment 2');
      }
    }
  });

  describe('fromRef option', () => {
    let repositoryFactory: RepositoryFactory;
    let repo: Repository;

    function getRepoOptionsAndPackages(repoOptions?: Partial<RepoOptions>) {
      return getOptionsAndPackages({ ...repoOptions, path: repo.rootPath });
    }

    beforeAll(() => {
      // These tests can share a single factory and repo because they don't push to the remote,
      // and the repo is reset after each test (which is faster than making new clones).
      // Also, readChangeFiles doesn't directly care about single package vs monorepo, so we can
      // use the monorepo fixture for all tests that need git (not all the tests need git).
      repositoryFactory = new RepositoryFactory('monorepo');
      repo = repositoryFactory.cloneRepository();
    });

    afterEach(() => {
      repo.resetAndClean();
    });

    afterAll(() => {
      repositoryFactory.cleanUp();
    });

    it('filters change files to only those modified since fromRef', () => {
      const { options: initialOptions } = getRepoOptionsAndPackages({ commit: true });

      // Create an initial change file and commit it
      repo.commitChange('file1');
      generateChangeFiles(['foo'], initialOptions);
      const firstCommit = repo.getCurrentHash();

      // Create another change file after the reference point
      repo.commitChange('file2');
      generateChangeFiles(['bar', 'baz'], initialOptions);
      expect(getChangeFiles(initialOptions)).toHaveLength(3);

      // Read change files with fromRef set to the first commit
      const { options: optionsFromRef, packageInfos } = getRepoOptionsAndPackages({ fromRef: firstCommit });
      const changeSet = readChangeFiles(optionsFromRef, packageInfos);

      expect(changeSet).toHaveLength(2);
      const packageNames = changeSet.map(changeEntry => changeEntry.change.packageName).sort();
      expect(packageNames).toEqual(['bar', 'baz']);
    });

    it('returns empty set when no change files exist since fromRef', () => {
      const { options: initialOptions } = getRepoOptionsAndPackages({ commit: true });

      // Create change files and commit them
      repo.commitChange('file1');
      generateChangeFiles(['foo'], initialOptions);
      const changeCommit = repo.getCurrentHash();

      // Make another commit without change files
      repo.commitChange('file2');

      // Read change files from after the change file commit
      const { options, packageInfos } = getRepoOptionsAndPackages({ fromRef: changeCommit });
      const changeSet = readChangeFiles(options, packageInfos);

      expect(changeSet).toHaveLength(0);
    });

    it('excludes deleted change files when using fromRef', () => {
      const { options: initialOptions } = getRepoOptionsAndPackages({ commit: true });

      // Create two change files
      repo.commitChange('file1');
      generateChangeFiles(['foo', 'bar'], initialOptions);
      const firstCommit = repo.getCurrentHash();

      // Delete the bar change file
      const changeFiles = fs.readdirSync(repo.pathTo('change'));
      const barChangeFile = changeFiles.find(file => file.includes('bar'));
      expect(barChangeFile).toBeTruthy();
      repo.git(['rm', repo.pathTo('change', barChangeFile!)]);
      repo.commitChange('delete bar change file');

      // Add another change file
      repo.commitChange('file2');
      generateChangeFiles(['baz'], initialOptions);

      // Read change files with fromRef - should only include foo (bar was deleted)
      const { options, packageInfos } = getRepoOptionsAndPackages({ fromRef: firstCommit });
      const changeSet = readChangeFiles(options, packageInfos);

      expect(changeSet).toHaveLength(1);
      expect(changeSet[0].change.packageName).toBe('baz');
    });
  });
});
