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
import { ChangeFileInfo } from '../types/ChangeInfo';
import { MonoRepoFactory } from '../fixtures/monorepo';
import { ChangelogJson } from '../types/ChangeLog';

function getChange(partialChange: Partial<ChangeFileInfo> = {}): ChangeFileInfo {
  return {
    comment: 'comment 1',
    date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
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

  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    monoRepoFactory = new MonoRepoFactory();
    await monoRepoFactory.create();
  });

  afterAll(async () => {
    await repositoryFactory.cleanUp();
    await monoRepoFactory.cleanUp();
  });

  describe('readChangeFiles', () => {
    it('adds actual commit hash', async () => {
      const repository = await repositoryFactory.cloneRepository();
      await repository.commitChange('foo');
      writeChangeFiles({ foo: getChange() }, repository.rootPath);

      const currentHash = await repository.getCurrentHash();
      const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions);
      const changes = [...changeSet.values()];
      expect(changes).toHaveLength(1);
      expect(changes[0].commit).toBe(currentHash);
    });

    it('uses hash of original commit', async () => {
      const repository = await repositoryFactory.cloneRepository();
      const changeInfo: ChangeFileInfo = getChange();

      await repository.commitChange('foo');
      const changeFilePaths = writeChangeFiles({ foo: changeInfo }, repository.rootPath);
      const changeFilePath = path.relative(repository.rootPath, changeFilePaths[0]);
      const changeFileAddedHash = await repository.getCurrentHash();

      // change the change file
      await repository.commitChange(changeFilePath, JSON.stringify({ ...changeInfo, comment: 'comment 2' }, null, 2));
      await repository.commitChange(changeFilePath, JSON.stringify({ ...changeInfo, comment: 'comment 3' }, null, 2));

      // keeps original hash
      const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions);
      const changes = [...changeSet.values()];
      expect(changes).toHaveLength(1);
      expect(changes[0].commit).toBe(changeFileAddedHash);
    });
  });

  describe('writeChangelog', () => {
    it('generates correct changelog', async () => {
      const repository = await repositoryFactory.cloneRepository();
      await repository.commitChange('foo');
      writeChangeFiles({ foo: getChange() }, repository.rootPath);

      await repository.commitChange('bar');
      writeChangeFiles({ foo: getChange({ comment: 'comment 2' }) }, repository.rootPath);

      const beachballOptions = { path: repository.rootPath } as BeachballOptions;
      const changes = readChangeFiles(beachballOptions);

      // Gather all package info from package.json
      const packageInfos = getPackageInfos(repository.rootPath);

      await writeChangelog(beachballOptions, changes, packageInfos);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = await fs.readFile(changelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(text)).toMatchSnapshot();

      const changelogJsonFile = path.join(repository.rootPath, 'CHANGELOG.json');
      const jsonText = await fs.readFile(changelogJsonFile, { encoding: 'utf-8' });
      const changelogJson = JSON.parse(jsonText);
      expect(cleanJsonForSnapshot(changelogJson)).toMatchSnapshot();
    });

    it('generates correct grouped changelog', async () => {
      const monoRepo = await monoRepoFactory.cloneRepository();
      await monoRepo.commitChange('foo');
      writeChangeFiles({ foo: getChange() }, monoRepo.rootPath);

      await monoRepo.commitChange('bar');
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

      const changes = readChangeFiles(beachballOptions);

      // Gather all package info from package.json
      const packageInfos = getPackageInfos(monoRepo.rootPath);

      await writeChangelog(beachballOptions, changes, packageInfos);

      // Validate changelog for foo package
      const fooChangelogFile = path.join(monoRepo.rootPath, 'packages', 'foo', 'CHANGELOG.md');
      const fooChangelogText = await fs.readFile(fooChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(fooChangelogText)).toMatchSnapshot();

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = await fs.readFile(barChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot();

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = await fs.readFile(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot();
    });

    it('generates correct grouped changelog when grouped change log is saved to the same dir as a regular changelog', async () => {
      const monoRepo = await monoRepoFactory.cloneRepository();
      await monoRepo.commitChange('foo');
      writeChangeFiles({ foo: getChange() }, monoRepo.rootPath);

      await monoRepo.commitChange('bar');
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

      const changes = readChangeFiles(beachballOptions);

      // Gather all package info from package.json
      const packageInfos = getPackageInfos(monoRepo.rootPath);

      await writeChangelog(beachballOptions, changes, packageInfos);

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = await fs.readFile(barChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(barChangelogText)).toMatchSnapshot();

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'packages', 'foo', 'CHANGELOG.md');
      const groupedChangelogText = await fs.readFile(groupedChangelogFile, { encoding: 'utf-8' });
      expect(cleanMarkdownForSnapshot(groupedChangelogText)).toMatchSnapshot();
    });
  });
});
