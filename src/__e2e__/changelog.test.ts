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
import { BumpInfo } from '../types/BumpInfo';

function getChange(partialChange: Partial<ChangeFileInfo> = {}): ChangeFileInfo{
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
      const changes = [...changeSet.values()];
      expect(changes).toHaveLength(1);
      expect(changes[0].commit).toBe(undefined);
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

      await writeChangelog(
        beachballOptions,
        changes,
        { foo: { ...getChange({ comment: 'bump foo to v1.0.1' }), commit: 'bogus' } },
        packageInfos
      );

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

      await writeChangelog(beachballOptions, changes, {}, packageInfos);

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
              ignoreDependentChanges: true,
              masterPackageName: 'foo',
              changelogPath: monoRepo.rootPath,
              include: ['packages/foo', 'packages/bar', 'packages/baz'],
            },
          ],
        },
      } as BeachballOptions;

      const packageInfos = getPackageInfos(monoRepo.rootPath);
      const changes = readChangeFiles(beachballOptions, packageInfos);
      // Simulates a dependent change from updateRelatedChangeType
      const dependentChanges: BumpInfo['dependentChangeInfos'] = {
        bar: {
          commit: '0xdeadbeef',
          ...getChange({ packageName: 'bar', dependentChange: true, comment: 'Bump baz to v1.3.5'}),
        },
      }
      await writeChangelog(beachballOptions, changes, dependentChanges, packageInfos);

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

      await writeChangelog(beachballOptions, changes, {}, packageInfos);

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
          changeFiles: (changeFile, changeFilePath) => {
            // For test, we will be changing the comment based on the package name
            if(changeFile.packageName === 'foo'){
              changeFile.comment = editedComment;
            }
            return changeFile;
          }
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
      for(const [changeFileName, changeInfo] of changes){
        if(changeFileName.substr(0, 3) === 'foo'){
          expect(changeInfo.comment).toBe(editedComment);
        }else{
          expect(changeInfo.comment).toBe('comment 2');
        }
      }
    });
  });
});
