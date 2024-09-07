import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';

import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { BeachballOptions } from '../../types/BeachballOptions';
import type { Repository } from '../../__fixtures__/repository';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { ChangeInfo } from '../../types/ChangeInfo';

describe('readChangeFiles', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: RepositoryFactory;
  let repo: Repository | undefined;
  let sharedSingleRepo: Repository;
  let sharedMonoRepo: Repository;

  const logs = initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      ...options,
    };
  }

  beforeAll(() => {
    // These tests can share the same factories and repos because they don't push to the remote,
    // and the repo used is reset after each test (which is faster than making new clones).
    repositoryFactory = new RepositoryFactory('single');
    monoRepoFactory = new RepositoryFactory('monorepo');
    sharedSingleRepo = repositoryFactory.cloneRepository();
    sharedMonoRepo = monoRepoFactory.cloneRepository();
  });

  afterEach(() => {
    // Revert whichever shared repo was used to the original state
    repo?.resetAndClean();
    repo = undefined;
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    monoRepoFactory.cleanUp();
  });

  it('does not add commit hash', () => {
    repo = sharedSingleRepo;
    repo.commitChange('foo');

    const options = getOptions();
    generateChangeFiles(['foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(changeSet[0].change.commit).toBe(undefined);
  });

  it('reads from a custom changeDir', () => {
    repo = sharedSingleRepo;
    repo.commitChange('foo');

    const options = getOptions({ changeDir: 'changeDir' });
    generateChangeFiles(['foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
  });

  it('excludes invalid change files', () => {
    repo = sharedMonoRepo;
    repo.updateJsonFile('packages/bar/package.json', { private: true });
    const options = getOptions();

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes invalid changes from grouped change file in monorepo', () => {
    repo = sharedMonoRepo;
    repo.updateJsonFile('packages/bar/package.json', { private: true });

    const options = getOptions({ groupChanges: true });

    // fake doesn't exist, bar is private, foo is okay
    generateChangeFiles(['fake', 'bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);

    expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
    expect(logs.mocks.warn).toHaveBeenCalledWith(
      expect.stringContaining('Change detected for nonexistent package fake')
    );
  });

  it('excludes out of scope change files in monorepo', () => {
    repo = sharedMonoRepo;

    const options = getOptions({ scope: ['packages/foo'] });

    generateChangeFiles(['bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('excludes out of scope changes from grouped change file in monorepo', () => {
    repo = sharedMonoRepo;

    const options = getOptions({ scope: ['packages/foo'], groupChanges: true });

    generateChangeFiles(['bar', 'foo'], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changeSet = readChangeFiles(options, packageInfos);
    expect(changeSet).toHaveLength(1);
    expect(logs.mocks.warn).not.toHaveBeenCalled();
  });

  it('runs transform.changeFiles functions if provided', async () => {
    const editedComment: string = 'Edited comment for testing';
    repo = sharedMonoRepo;

    const options = getOptions({
      command: 'change',
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
            masterPackageName: 'foo',
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

    const packageInfos = getPackageInfos(repo.rootPath);
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
});
