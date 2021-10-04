import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';

import { RepositoryFactory } from '../fixtures/repository';
import { writeChangelog } from '../changelog/writeChangelog';

import { getPackageInfos } from '../monorepo/getPackageInfos';

import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { SortedChangeTypes } from '../changefile/getPackageChangeTypes';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeFileInfo, ChangeInfo } from '../types/ChangeInfo';
import { MonoRepoFactory } from '../fixtures/monorepo';
import { ChangelogJson } from '../types/ChangeLog';

function getChange(partialChange: Partial<ChangeFileInfo> = {}): ChangeFileInfo {
  return {
    comment: 'comment 1',
    email: 'test@testtestme.com',
    packageName: 'foo',
    type: 'patch',
    dependentChangeType: 'patch',
    ...partialChange,
  };
}

function cleanMarkdownForSnapshot(text: string) {
  return text.replace(/\w\w\w, \d\d \w\w\w [\d :]+?GMT/gm, '(date)');
}

function cleanJsonForSnapshot(changelog: ChangelogJson) {
  changelog = _.cloneDeep(changelog);
  for (const entry of changelog.entries) {
    entry.date = '(date)';
    for (const changeType of SortedChangeTypes) {
      if (entry.comments[changeType]) {
        for (const comment of entry.comments[changeType]!) {
          comment.commit = '(sha1)';
        }
      }
    }
  }
  return changelog;
}

describe('changelog generation', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: MonoRepoFactory;

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
      writeChangeFiles({ foo: getChange() }, repository.rootPath);

      const packageInfos = getPackageInfos(repository.rootPath);
      const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions, packageInfos);
      expect(changeSet).toHaveLength(1);
      expect(changeSet[0].change.commit).toBe(undefined);
    });

    it('does not add commit hash with groupChanges', () => {
      const repository = repositoryFactory.cloneRepository();
      repository.commitChange('foo');
      writeChangeFiles(
        { foo: getChange(), bar: getChange() },
        repository.rootPath,
        true, // commit
        true // groupChanges
      );

      const packageInfos = getPackageInfos(repository.rootPath);
      const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions, packageInfos);
      expect(changeSet).toHaveLength(2);
      expect(changeSet[0].change.commit).toBe(undefined);
    });
  });

  describe('writeChangelog', () => {
    it('generates correct changelog', async () => {
      const repository = repositoryFactory.cloneRepository();
      repository.commitChange('foo');
      writeChangeFiles({ foo: getChange({ comment: 'additional comment 2' }) }, repository.rootPath);
      writeChangeFiles({ foo: getChange({ comment: 'additional comment 1' }) }, repository.rootPath);
      writeChangeFiles({ foo: getChange() }, repository.rootPath);

      repository.commitChange('bar');
      writeChangeFiles({ foo: getChange({ comment: 'comment 2' }) }, repository.rootPath);

      const beachballOptions = { path: repository.rootPath } as BeachballOptions;
      const packageInfos = getPackageInfos(repository.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(beachballOptions, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = fs.readFileSync(changelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(text)).toMatchSnapshot();

      const changelogJsonFile = path.join(repository.rootPath, 'CHANGELOG.json');
      const jsonText = fs.readFileSync(changelogJsonFile, { encoding: 'utf-8' });
      const changelogJson = JSON.parse(jsonText);
      expect(cleanJsonForSnapshot(changelogJson)).toMatchSnapshot();

      expect(changelogJson.entries[0].comments.patch[0].commit).toBe(repository.getCurrentHash());
    });

    it.only('generates correct changelog with groupChanges', async () => {
      const repository = repositoryFactory.cloneRepository();
      repository.commitChange('foo');
      writeChangeFiles(
        {
          foo: getChange({ comment: 'additional comment 2' }),
          bar: getChange({ comment: 'comment from bar change ' }),
        },
        repository.rootPath,
        true,
        true
      );
      writeChangeFiles({ foo: getChange({ comment: 'additional comment 1' }) }, repository.rootPath, true, true);
      writeChangeFiles({ foo: getChange() }, repository.rootPath, true, true);

      repository.commitChange('bar');
      writeChangeFiles({ foo: getChange({ comment: 'comment 2' }) }, repository.rootPath, true, true);

      const beachballOptions = { path: repository.rootPath, groupChanges: true } as BeachballOptions;
      const packageInfos = getPackageInfos(repository.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);

      await writeChangelog(beachballOptions, changes, { foo: 'patch', bar: 'patch' }, {}, packageInfos);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = fs.readFileSync(changelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(text)).toMatchSnapshot();

      const changelogJsonFile = path.join(repository.rootPath, 'CHANGELOG.json');
      const jsonText = fs.readFileSync(changelogJsonFile, { encoding: 'utf-8' });
      const changelogJson = JSON.parse(jsonText);
      expect(cleanJsonForSnapshot(changelogJson)).toMatchSnapshot();

      expect(changelogJson.entries[0].comments.patch[0].commit).toBe(repository.getCurrentHash());
    });

    it('generates correct grouped changelog', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('foo');
      writeChangeFiles({ foo: getChange() }, monoRepo.rootPath);

      monoRepo.commitChange('bar');
      writeChangeFiles({ bar: getChange({ packageName: 'bar', comment: 'comment 2' }) }, monoRepo.rootPath);

      writeChangeFiles({ bar: getChange({ packageName: 'bar', comment: 'comment 3' }) }, monoRepo.rootPath);

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
      expect(cleanMarkdownForSnapshot(fooChangelogText)).toMatchSnapshot();

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = fs.readFileSync(barChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot();

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot();
    });

    it('generates grouped changelog without dependent change entries', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('baz');
      writeChangeFiles({ baz: getChange({ packageName: 'baz' }) }, monoRepo.rootPath);

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
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot();

      // Validate changelog for baz package
      const bazChangelogFile = path.join(monoRepo.rootPath, 'packages', 'baz', 'CHANGELOG.md');
      const bazChangelogText = fs.readFileSync(bazChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(bazChangelogText)).toMatchSnapshot();

      // Validate grouped changelog for foo master package
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot();
    });

    it('generates grouped changelog without dependent change entries where packages have normal changes and dependenc changes', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('baz');
      writeChangeFiles({ baz: getChange({ packageName: 'baz' }) }, monoRepo.rootPath);
      writeChangeFiles({ bar: getChange({ packageName: 'bar' }) }, monoRepo.rootPath);

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
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot();

      // Validate changelog for baz package
      const bazChangelogFile = path.join(monoRepo.rootPath, 'packages', 'baz', 'CHANGELOG.md');
      const bazChangelogText = fs.readFileSync(bazChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(bazChangelogText)).toMatchSnapshot();

      // Validate grouped changelog for foo master package
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = fs.readFileSync(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot();
    });

    it('generates correct grouped changelog when grouped change log is saved to the same dir as a regular changelog', async () => {
      const monoRepo = monoRepoFactory.cloneRepository();
      monoRepo.commitChange('foo');
      writeChangeFiles({ foo: getChange() }, monoRepo.rootPath);

      monoRepo.commitChange('bar');
      writeChangeFiles({ bar: getChange({ packageName: 'bar', comment: 'comment 2' }) }, monoRepo.rootPath);

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
      writeChangeFiles({ foo: getChange() }, monoRepo.rootPath);

      monoRepo.commitChange('bar');
      writeChangeFiles({ bar: getChange({ packageName: 'bar', comment: 'comment 2' }) }, monoRepo.rootPath);

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
