import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { cleanChangelogJson, readChangelogJson, readChangelogMd } from '../../__fixtures__/changelog';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import { writeChangelog } from '../../changelog/writeChangelog';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { BeachballOptions } from '../../types/BeachballOptions';
import { ChangeFileInfo, ChangeInfo } from '../../types/ChangeInfo';

function getChange(packageName: string, comment: string): ChangeFileInfo {
  return {
    comment,
    email: 'test@testtestme.com',
    packageName,
    type: 'patch',
    dependentChangeType: 'patch',
  };
}

describe('writeChangelog', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: RepositoryFactory;

  initMockLogs();

  beforeAll(() => {
    // These tests can share the same repo factories because they don't push to origin
    // (the actual tests run against a clone)
    repositoryFactory = new RepositoryFactory('single');
    monoRepoFactory = new RepositoryFactory('monorepo');
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    monoRepoFactory.cleanUp();
  });

  it('generates correct changelog', async () => {
    const repository = repositoryFactory.cloneRepository();
    repository.commitChange('foo');
    generateChangeFiles([getChange('foo', 'additional comment 2')], repository.rootPath);
    generateChangeFiles([getChange('foo', 'additional comment 1')], repository.rootPath);
    generateChangeFiles([getChange('foo', 'comment 1')], repository.rootPath);

    repository.commitChange('bar');
    generateChangeFiles([getChange('foo', 'comment 2')], repository.rootPath);

    const beachballOptions = { path: repository.rootPath } as BeachballOptions;
    const packageInfos = getPackageInfos(repository.rootPath);
    const changes = readChangeFiles(beachballOptions, packageInfos);

    await writeChangelog(beachballOptions, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

    expect(readChangelogMd(repository.rootPath)).toMatchSnapshot('changelog md');

    const changelogJson = readChangelogJson(repository.rootPath);
    expect(cleanChangelogJson(changelogJson)).toMatchSnapshot('changelog json');

    // Every entry should have a different commit hash
    const patchComments = changelogJson.entries[0].comments.patch!;
    const commits = patchComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(patchComments.length);

    // The first entry should be the newest
    expect(patchComments[0].commit).toBe(repository.getCurrentHash());
  });

  it('generates correct changelog with changeDir set', async () => {
    const testChangeDir = 'myChangeDir';
    const repository = repositoryFactory.cloneRepository();
    repository.commitChange('foo');
    generateChangeFiles([getChange('foo', 'additional comment 2')], repository.rootPath, undefined, testChangeDir);
    generateChangeFiles([getChange('foo', 'additional comment 1')], repository.rootPath, undefined, testChangeDir);
    generateChangeFiles([getChange('foo', 'comment 1')], repository.rootPath, undefined, testChangeDir);

    repository.commitChange('bar');
    generateChangeFiles([getChange('foo', 'comment 2')], repository.rootPath, undefined, testChangeDir);

    const beachballOptions = { path: repository.rootPath, changeDir: testChangeDir } as BeachballOptions;
    const packageInfos = getPackageInfos(repository.rootPath);
    const changes = readChangeFiles(beachballOptions, packageInfos);

    await writeChangelog(beachballOptions, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

    expect(readChangelogMd(repository.rootPath)).toMatchSnapshot('changelog md');

    const changelogJson = readChangelogJson(repository.rootPath);
    expect(cleanChangelogJson(changelogJson)).toMatchSnapshot('changelog json');

    // Every entry should have a different commit hash
    const patchComments = changelogJson.entries[0].comments.patch!;
    const commits = patchComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(patchComments.length);

    // The first entry should be the newest
    expect(patchComments[0].commit).toBe(repository.getCurrentHash());
  });

  it('generates correct changelog in monorepo with groupChanges (grouped change FILES)', async () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.commitChange('foo');
    const params = [monoRepo.rootPath, true /*groupChanges*/] as const;
    generateChangeFiles(
      [getChange('foo', 'additional comment 2'), getChange('bar', 'comment from bar change ')],
      ...params
    );
    generateChangeFiles([getChange('foo', 'additional comment 1')], ...params);
    generateChangeFiles([getChange('foo', 'comment 1')], ...params);

    monoRepo.commitChange('bar');
    generateChangeFiles([getChange('foo', 'comment 2')], ...params);

    const beachballOptions = { path: monoRepo.rootPath, groupChanges: true } as BeachballOptions;
    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changes = readChangeFiles(beachballOptions, packageInfos);

    await writeChangelog(beachballOptions, changes, { foo: 'patch', bar: 'patch' }, {}, packageInfos);

    // check changelogs for both foo and bar
    expect(readChangelogMd(monoRepo.pathTo('packages/foo'))).toMatchSnapshot('foo CHANGELOG.md');
    expect(readChangelogMd(monoRepo.pathTo('packages/bar'))).toMatchSnapshot('bar CHANGELOG.md');

    const fooJson = readChangelogJson(monoRepo.pathTo('packages/foo'));
    expect(cleanChangelogJson(fooJson)).toMatchSnapshot('foo CHANGELOG.json');
    expect(readChangelogJson(monoRepo.pathTo('packages/bar'), true /*clean*/)).toMatchSnapshot('bar CHANGELOG.json');

    // Every entry should have a different commit hash
    const patchComments = fooJson.entries[0].comments.patch!;
    const commits = patchComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(patchComments.length);

    // The first entry should be the newest
    expect(patchComments[0].commit).toBe(monoRepo.getCurrentHash());
  });

  it('generates correct grouped changelog', async () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'comment 1')], monoRepo.rootPath);

    monoRepo.commitChange('bar');
    generateChangeFiles([getChange('bar', 'comment 2')], monoRepo.rootPath);
    generateChangeFiles([getChange('bar', 'comment 3')], monoRepo.rootPath);

    const beachballOptions: Partial<BeachballOptions> = {
      path: monoRepo.rootPath,
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: monoRepo.rootPath,
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    };

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changes = readChangeFiles(beachballOptions as BeachballOptions, packageInfos);

    await writeChangelog(beachballOptions as BeachballOptions, changes, {}, {}, packageInfos);

    // Validate changelog for foo and bar packages
    expect(readChangelogMd(monoRepo.pathTo('packages/foo'))).toMatchSnapshot('foo CHANGELOG.md');
    expect(readChangelogMd(monoRepo.pathTo('packages/bar'))).toMatchSnapshot('bar CHANGELOG.md');

    // Validate grouped changelog for foo and bar packages
    expect(readChangelogMd(monoRepo.rootPath)).toMatchSnapshot('grouped CHANGELOG.md');
  });

  it('generates grouped changelog without dependent change entries', async () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.commitChange('baz');
    generateChangeFiles([getChange('baz', 'comment 1')], monoRepo.rootPath);

    const beachballOptions: Partial<BeachballOptions> = {
      path: monoRepo.rootPath,
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: monoRepo.rootPath,
            include: ['packages/foo', 'packages/bar', 'packages/baz'],
          },
        ],
      },
    };

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changes = readChangeFiles(beachballOptions as BeachballOptions, packageInfos);

    await writeChangelog(
      beachballOptions as BeachballOptions,
      changes,
      { bar: 'patch', baz: 'patch' },
      { bar: new Set(['baz']) },
      packageInfos
    );

    // Validate changelog for bar package
    const barChangelogText = readChangelogMd(monoRepo.pathTo('packages/bar'));
    expect(barChangelogText).toContain('- Bump baz');
    expect(barChangelogText).toMatchSnapshot('bar CHANGELOG.md');

    // Validate changelog for baz package
    expect(readChangelogMd(monoRepo.pathTo('packages/baz'))).toMatchSnapshot('baz CHANGELOG.md');

    // Validate grouped changelog for foo master package
    const groupedChangelogText = readChangelogMd(monoRepo.rootPath);
    expect(groupedChangelogText).toContain('- comment 1');
    expect(groupedChangelogText).not.toContain('- Bump baz');
    expect(groupedChangelogText).toMatchSnapshot('grouped CHANGELOG.md');
  });

  it('generates grouped changelog without dependent change entries where packages have normal changes and dependency changes', async () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.commitChange('baz');
    generateChangeFiles([getChange('baz', 'comment 1')], monoRepo.rootPath);
    generateChangeFiles([getChange('bar', 'comment 1')], monoRepo.rootPath);

    const beachballOptions: Partial<BeachballOptions> = {
      path: monoRepo.rootPath,
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: monoRepo.rootPath,
            include: ['packages/foo', 'packages/bar', 'packages/baz'],
          },
        ],
      },
    };

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changes = readChangeFiles(beachballOptions as BeachballOptions, packageInfos);

    await writeChangelog(
      beachballOptions as BeachballOptions,
      changes,
      { bar: 'patch', baz: 'patch' },
      { bar: new Set(['baz']) },
      packageInfos
    );

    // Validate changelog for bar and baz packages
    expect(readChangelogMd(monoRepo.pathTo('packages/bar'))).toMatchSnapshot('bar CHANGELOG.md');
    expect(readChangelogMd(monoRepo.pathTo('packages/baz'))).toMatchSnapshot('baz CHANGELOG.md');

    // Validate grouped changelog for foo master package
    expect(readChangelogMd(monoRepo.rootPath)).toMatchSnapshot('grouped CHANGELOG.md');
  });

  it('generates correct grouped changelog when grouped change log is saved to the same dir as a regular changelog', async () => {
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'comment 1')], monoRepo.rootPath);

    monoRepo.commitChange('bar');
    generateChangeFiles([getChange('bar', 'comment 2')], monoRepo.rootPath);

    const beachballOptions: Partial<BeachballOptions> = {
      path: monoRepo.rootPath,
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: monoRepo.pathTo('packages/foo'),
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    };

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changes = readChangeFiles(beachballOptions as BeachballOptions, packageInfos);

    await writeChangelog(beachballOptions as BeachballOptions, changes, {}, {}, packageInfos);

    // Validate changelog for bar package
    expect(readChangelogMd(monoRepo.pathTo('packages/bar'))).toMatchSnapshot();

    // Validate grouped changelog for foo and bar packages
    expect(readChangelogMd(monoRepo.pathTo('packages/foo'))).toMatchSnapshot();
  });

  it('runs transform.changeFiles functions if provided', async () => {
    const editedComment: string = 'Edited comment for testing';
    const monoRepo = monoRepoFactory.cloneRepository();
    monoRepo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'comment 1')], monoRepo.rootPath);

    monoRepo.commitChange('bar');
    generateChangeFiles([getChange('bar', 'comment 2')], monoRepo.rootPath);

    const beachballOptions: Partial<BeachballOptions> = {
      path: monoRepo.rootPath,
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
            changelogPath: monoRepo.pathTo('packages/foo'),
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    };

    const packageInfos = getPackageInfos(monoRepo.rootPath);
    const changes = readChangeFiles(beachballOptions as BeachballOptions, packageInfos);

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
