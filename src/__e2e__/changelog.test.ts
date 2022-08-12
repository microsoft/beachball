import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';

import { initMockLogs } from '../__fixtures__/mockLogs';
import { MonoRepoFactory, packageJsonFixtures } from '../__fixtures__/monorepo';
import { RepositoryFactory } from '../__fixtures__/repository';

import { writeChangelog } from '../changelog/writeChangelog';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { SortedChangeTypes } from '../changefile/getPackageChangeTypes';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeFileInfo, ChangeInfo } from '../types/ChangeInfo';
import { ChangelogJson } from '../types/ChangeLog';

function getChange(packageName: string, comment: string): ChangeFileInfo {
  return {
    comment,
    email: 'test@testtestme.com',
    packageName,
    type: 'patch',
    dependentChangeType: 'patch',
  };
}

function cleanMarkdownForSnapshot(text: string) {
  return text.replace(/\w\w\w, \d\d \w\w\w [\d :]+?GMT/gm, '(date)');
}

function cleanJsonForSnapshot(changelog: ChangelogJson) {
  changelog = _.cloneDeep(changelog);
  // for a better snapshot, make the fake commit match if the real commit did
  const fakeCommits: { [commit: string]: string } = {};
  let fakeHashNum = 0;

  for (const entry of changelog.entries) {
    entry.date = '(date)';
    for (const changeType of SortedChangeTypes) {
      if (entry.comments[changeType]) {
        for (const comment of entry.comments[changeType]!) {
          if (!fakeCommits[comment.commit]) {
            fakeCommits[comment.commit] = `(sha1-${fakeHashNum++})`;
          }
          comment.commit = fakeCommits[comment.commit];
        }
      }
    }
  }
  return changelog;
}

describe('changelog generation', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: MonoRepoFactory;

  const logs = initMockLogs();

  beforeAll(() => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    monoRepoFactory = new MonoRepoFactory();
    monoRepoFactory.create();
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    monoRepoFactory.cleanUp();
  });

  describe('readChangeFiles', () => {
    it('does not add commit hash', () => {
      const repository = repositoryFactory.cloneRepository();
      repository.commitChange('foo');
      writeChangeFiles({ changes: [getChange('foo', 'comment 1')], cwd: repository.rootPath });

      const packageInfos = getPackageInfos(repository.rootPath);
      const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions, packageInfos);
      expect(changeSet).toHaveLength(1);
      expect(changeSet[0].change.commit).toBe(undefined);
    });

    it('excludes invalid change files', () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange(
        'packages/bar/package.json',
        JSON.stringify({ ...packageJsonFixtures['packages/bar'], private: true })
      );
      // fake doesn't exist, bar is private, foo is okay
      writeChangeFiles({
        changes: [getChange('fake', 'comment 1'), getChange('bar', 'comment 2'), getChange('foo', 'comment 3')],
        cwd: monoRepo.rootPath,
      });

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changeSet = readChangeFiles({ path: monoRepo.rootPath } as BeachballOptions, packageInfos);
      expect(changeSet).toHaveLength(1);

      expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
      expect(logs.mocks.warn).toHaveBeenCalledWith(
        expect.stringContaining('Change detected for nonexistent package fake')
      );
    });

    it('excludes invalid changes from grouped change file', () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange(
        'packages/bar/package.json',
        JSON.stringify({ ...packageJsonFixtures['packages/bar'], private: true })
      );
      // fake doesn't exist, bar is private, foo is okay
      writeChangeFiles({
        changes: [getChange('fake', 'comment 1'), getChange('bar', 'comment 2'), getChange('foo', 'comment 3')],
        cwd: monoRepo.rootPath,
        groupChanges: true,
      });

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changeSet = readChangeFiles(
        { path: monoRepo.rootPath, groupChanges: true } as BeachballOptions,
        packageInfos
      );
      expect(changeSet).toHaveLength(1);

      expect(logs.mocks.warn).toHaveBeenCalledWith(expect.stringContaining('Change detected for private package bar'));
      expect(logs.mocks.warn).toHaveBeenCalledWith(
        expect.stringContaining('Change detected for nonexistent package fake')
      );
    });

    it('excludes out of scope change files', () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      writeChangeFiles({
        changes: [getChange('bar', 'comment 2'), getChange('foo', 'comment 3')],
        cwd: monoRepo.rootPath,
      });

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changeSet = readChangeFiles(
        { path: monoRepo.rootPath, scope: ['packages/foo'] } as BeachballOptions,
        packageInfos
      );
      expect(changeSet).toHaveLength(1);
      expect(logs.mocks.warn).not.toHaveBeenCalled();
    });

    it('excludes out of scope changes from grouped change file', () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      writeChangeFiles({
        changes: [getChange('bar', 'comment 2'), getChange('foo', 'comment 3')],
        cwd: monoRepo.rootPath,
        groupChanges: true,
      });

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changeSet = readChangeFiles(
        { path: monoRepo.rootPath, scope: ['packages/foo'], groupChanges: true } as BeachballOptions,
        packageInfos
      );
      expect(changeSet).toHaveLength(1);
      expect(logs.mocks.warn).not.toHaveBeenCalled();
    });
  });

  describe('writeChangelog', () => {
    it('generates correct changelog', async () => {
      const repository = repositoryFactory.cloneRepository();
      repository.commitChange('foo');
      writeChangeFiles({ changes: [getChange('foo', 'additional comment 2')], cwd: repository.rootPath });
      writeChangeFiles({ changes: [getChange('foo', 'additional comment 1')], cwd: repository.rootPath });
      writeChangeFiles({ changes: [getChange('foo', 'comment 1')], cwd: repository.rootPath });

      repository.commitChange('bar');
      writeChangeFiles({ changes: [getChange('foo', 'comment 2')], cwd: repository.rootPath });

      const beachballOptions = { path: repository.rootPath } as BeachballOptions;
      const packageInfos = getPackageInfos(repository.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(beachballOptions, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = fs.readFileSync(changelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(text)).toMatchSnapshot('changelog json');

      const changelogJsonFile = path.join(repository.rootPath, 'CHANGELOG.json');
      const changelogJson: ChangelogJson = fs.readJSONSync(changelogJsonFile);
      expect(cleanJsonForSnapshot(changelogJson)).toMatchSnapshot('changelog md');

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
      const options: Omit<Parameters<typeof writeChangeFiles>[0], 'changes'> = {
        cwd: monoRepo.rootPath,
        groupChanges: true,
      };
      writeChangeFiles({
        changes: [getChange('foo', 'additional comment 2'), getChange('bar', 'comment from bar change ')],
        ...options,
      });
      writeChangeFiles({ changes: [getChange('foo', 'additional comment 1')], ...options });
      writeChangeFiles({ changes: [getChange('foo', 'comment 1')], ...options });

      monoRepo.commitChange('bar');
      writeChangeFiles({ changes: [getChange('foo', 'comment 2')], ...options });

      const beachballOptions = { path: monoRepo.rootPath, groupChanges: true } as BeachballOptions;
      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(beachballOptions, changes, { foo: 'patch', bar: 'patch' }, {}, packageInfos);

      // check changelogs for both foo and bar
      const fooText = fs.readFileSync(path.join(monoRepo.rootPath, 'packages/foo/CHANGELOG.md'), { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(fooText)).toMatchSnapshot('foo CHANGELOG.md');
      const barText = fs.readFileSync(path.join(monoRepo.rootPath, 'packages/bar/CHANGELOG.md'), { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barText)).toMatchSnapshot('bar CHANGELOG.md');

      const fooJson: ChangelogJson = fs.readJSONSync(path.join(monoRepo.rootPath, 'packages/foo/CHANGELOG.json'));
      expect(cleanJsonForSnapshot(fooJson)).toMatchSnapshot('foo CHANGELOG.json');
      const barJson: ChangelogJson = fs.readJSONSync(path.join(monoRepo.rootPath, 'packages/bar/CHANGELOG.json'));
      expect(cleanJsonForSnapshot(barJson)).toMatchSnapshot('bar CHANGELOG.json');

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
      writeChangeFiles({ changes: [getChange('foo', 'comment 1')], cwd: monoRepo.rootPath });

      monoRepo.commitChange('bar');
      writeChangeFiles({ changes: [getChange('bar', 'comment 2')], cwd: monoRepo.rootPath });

      writeChangeFiles({ changes: [getChange('bar', 'comment 3')], cwd: monoRepo.rootPath });

      const beachballOptions = {
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
      } as BeachballOptions;

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(beachballOptions, changes, {}, {}, packageInfos);

      // Validate changelog for foo package
      const fooChangelogFile = path.join(monoRepo.rootPath, 'packages', 'foo', 'CHANGELOG.md');
      const fooChangelogText = fs.readFileSync(fooChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(fooChangelogText)).toMatchSnapshot('foo CHANGELOG.md');

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = fs.readFileSync(barChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot('bar CHANGELOG.md');

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot('grouped CHANGELOG.md');
    });

    it('generates grouped changelog without dependent change entries', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('baz');
      writeChangeFiles({ changes: [getChange('baz', 'comment 1')], cwd: monoRepo.rootPath });

      const beachballOptions = {
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
      } as BeachballOptions;

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(
        beachballOptions,
        changes,
        { bar: 'patch', baz: 'patch' },
        { bar: new Set(['baz']) },
        packageInfos
      );

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = fs.readFileSync(barChangelogFile, { encoding: 'utf-8' });
      expect(barChangelogText).toContain('- Bump baz');
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot('bar CHANGELOG.md');

      // Validate changelog for baz package
      const bazChangelogFile = path.join(monoRepo.rootPath, 'packages', 'baz', 'CHANGELOG.md');
      const bazChangelogText = fs.readFileSync(bazChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(bazChangelogText)).toMatchSnapshot('baz CHANGELOG.md');

      // Validate grouped changelog for foo master package
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(groupedChangelogText).toContain('- comment 1');
      expect(groupedChangelogText).not.toContain('- Bump baz');
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot('grouped CHANGELOG.md');
    });

    it('generates grouped changelog without dependent change entries where packages have normal changes and dependency changes', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('baz');
      writeChangeFiles({ changes: [getChange('baz', 'comment 1')], cwd: monoRepo.rootPath });
      writeChangeFiles({ changes: [getChange('bar', 'comment 1')], cwd: monoRepo.rootPath });

      const beachballOptions = {
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
      } as BeachballOptions;

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(
        beachballOptions,
        changes,
        { bar: 'patch', baz: 'patch' },
        { bar: new Set(['baz']) },
        packageInfos
      );

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = fs.readFileSync(barChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot('bar CHANGELOG.md');

      // Validate changelog for baz package
      const bazChangelogFile = path.join(monoRepo.rootPath, 'packages', 'baz', 'CHANGELOG.md');
      const bazChangelogText = fs.readFileSync(bazChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(bazChangelogText)).toMatchSnapshot('baz CHANGELOG.md');

      // Validate grouped changelog for foo master package
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot('grouped CHANGELOG.md');
    });

    it('generates correct grouped changelog when grouped change log is saved to the same dir as a regular changelog', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('foo');
      writeChangeFiles({ changes: [getChange('foo', 'comment 1')], cwd: monoRepo.rootPath });

      monoRepo.commitChange('bar');
      writeChangeFiles({ changes: [getChange('bar', 'comment 2')], cwd: monoRepo.rootPath });

      const beachballOptions = {
        path: monoRepo.rootPath,
        changelog: {
          groups: [
            {
              masterPackageName: 'foo',
              changelogPath: path.join(monoRepo.rootPath, 'packages', 'foo'),
              include: ['packages/foo', 'packages/bar'],
            },
          ],
        },
      } as BeachballOptions;

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(beachballOptions, changes, {}, {}, packageInfos);

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = fs.readFileSync(barChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot();

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'packages', 'foo', 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot();
    });

    it('Verify that the changeFile transform functions are run, if provided', async () => {
      const editedComment: string = 'Edited comment for testing';
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('foo');
      writeChangeFiles({ changes: [getChange('foo', 'comment 1')], cwd: monoRepo.rootPath });

      monoRepo.commitChange('bar');
      writeChangeFiles({ changes: [getChange('bar', 'comment 2')], cwd: monoRepo.rootPath });

      const beachballOptions = {
        path: monoRepo.rootPath,
        transform: {
          changeFiles: (changeFile: ChangeInfo, changeFilePath) => {
            // For test, we will be changing the comment based on the package name
            if (changeFile.packageName === 'foo') {
              changeFile.comment = editedComment;
            }
            return changeFile;
          },
        },
        changelog: {
          groups: [
            {
              masterPackageName: 'foo',
              changelogPath: path.join(monoRepo.rootPath, 'packages', 'foo'),
              include: ['packages/foo', 'packages/bar'],
            },
          ],
        },
      } as BeachballOptions;

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      // Verify that the comment of only the intended change file is changed
      for (const { change, changeFile } of changes) {
        if (changeFile.substr(0, 3) === 'foo') {
          expect(change.comment).toBe(editedComment);
        } else {
          expect(change.comment).toBe('comment 2');
        }
      }
    });
  });
});
