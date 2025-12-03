import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import type { RepoOptions } from '../../types/BeachballOptions';
import type { Repository } from '../../__fixtures__/repository';
import type { ChangeInfo } from '../../types/ChangeInfo';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { getParsedOptions } from '../../options/getOptions';

describe('readChangeFiles', () => {
  let repositoryFactory: RepositoryFactory;
  let repo: Repository;

  const logs = initMockLogs();

  function getOptionsAndPackages(repoOptions?: Partial<RepoOptions>) {
    const parsedOptions = getParsedOptions({
      cwd: repo.rootPath,
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName, ...repoOptions },
    });
    const packageInfos = getPackageInfos(parsedOptions);
    return { packageInfos, options: parsedOptions.options, parsedOptions };
  }

  beforeAll(() => {
    // These tests can share a single factory and repo because they don't push to the remote,
    // and the repo is reset after each test (which is faster than making new clones).
    // Also, readChangeFiles doesn't directly care about single package vs monorepo, so we can
    // use the monorepo fixture for all tests.
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();
  });

  afterEach(() => {
    // Revert whichever shared repo was used to the original state
    repo.resetAndClean();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
  });

  it('reads change files and returns in reverse chronological order', async () => {
    repo.commitChange('foo');

    const { options, packageInfos } = getOptionsAndPackages();
    generateChangeFiles(['bar'], options);
    // Wait slightly to ensure the mtime is different for sorting
    await new Promise(resolve => setTimeout(resolve, 5));
    generateChangeFiles(['foo'], options);

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
    repo.commitChange('foo');

    const { options, packageInfos } = getOptionsAndPackages({ changeDir: 'changeDir' });
    generateChangeFiles(['foo'], options);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
  });

  it('excludes invalid change files', () => {
    repo.updateJsonFile('packages/bar/package.json', { private: true });
    const { options, packageInfos } = getOptionsAndPackages();

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes invalid changes from grouped change file in monorepo', () => {
    repo.updateJsonFile('packages/bar/package.json', { private: true });

    const { options, packageInfos } = getOptionsAndPackages({ groupChanges: true });

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes out of scope change files in monorepo', () => {
    const { options, packageInfos } = getOptionsAndPackages({ scope: ['packages/foo'] });

    generateChangeFiles(['bar', 'foo'], options);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('excludes out of scope changes from grouped change file in monorepo', () => {
    const { options, packageInfos } = getOptionsAndPackages({ scope: ['packages/foo'], groupChanges: true });

    generateChangeFiles(['bar', 'foo'], options);

    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('runs transform.changeFiles functions if provided', () => {
    const editedComment: string = 'Edited comment for testing';

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
            changelogPath: repo.pathTo('packages/foo'),
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    });

    repo.commitChange('foo');
    generateChangeFiles([{ packageName: 'foo', comment: 'comment 1' }], options);

    repo.commitChange('bar');
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
    it('filters change files to only those modified since fromRef', () => {
      const { options: initialOptions } = getOptionsAndPackages({ commit: true });

      // Create an initial change file and commit it
      repo.commitChange('file1');
      generateChangeFiles(['foo'], initialOptions);
      const firstCommit = repo.getCurrentHash();

      // Create another change file after the reference point
      repo.commitChange('file2');
      generateChangeFiles(['bar', 'baz'], initialOptions);

      // Read change files with fromRef set to the first commit
      const { options: optionsFromRef, packageInfos } = getOptionsAndPackages({ fromRef: firstCommit });
      const changeSet = readChangeFiles(optionsFromRef, packageInfos);

      expect(changeSet).toHaveLength(2);
      const packageNames = changeSet.map(changeEntry => changeEntry.change.packageName).sort();
      expect(packageNames).toEqual(['bar', 'baz']);
    });

    it('returns empty set when no change files exist since fromRef', () => {
      const { options: initialOptions } = getOptionsAndPackages({ commit: true });

      // Create change files and commit them
      repo.commitChange('file1');
      generateChangeFiles(['foo'], initialOptions);
      const changeCommit = repo.getCurrentHash();

      // Make another commit without change files
      repo.commitChange('file2');

      // Read change files from after the change file commit
      const { options, packageInfos } = getOptionsAndPackages({ fromRef: changeCommit });
      const changeSet = readChangeFiles(options, packageInfos);

      expect(changeSet).toHaveLength(0);
    });

    it('excludes deleted change files when using fromRef', () => {
      const { options: initialOptions } = getOptionsAndPackages({ commit: true });

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
      const { options, packageInfos } = getOptionsAndPackages({ fromRef: firstCommit });
      const changeSet = readChangeFiles(options, packageInfos);

      expect(changeSet).toHaveLength(1);
      expect(changeSet[0].change.packageName).toBe('baz');
    });
  });
});
