import path from 'path';
import fs from 'fs';

import { promisify } from 'util';

import { RepositoryFactory, Repository } from '../fixtures/repository';
import { writeChangelog } from '../changelog/writeChangelog';

import { getPackageInfos } from '../monorepo/getPackageInfos';

import unified from 'unified';
import remarkParse from 'remark-parse';
import { selectAll } from 'unist-util-select';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { readChangeFiles } from '../changefile/readChangeFiles';
import { BeachballOptions } from '../types/BeachballOptions';
import { ChangeFileInfo } from '../types/ChangeInfo';
import { MonoRepoFactory } from '../fixtures/monorepo';

const readFileAsync = promisify(fs.readFile);

function parseMarkdown(markdown: string) {
  return unified()
    .use(remarkParse)
    .parse(markdown);
}

describe('changelog generation', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: MonoRepoFactory;
  let repository: Repository;
  let monoRepo: Repository;

  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
    monoRepoFactory = new MonoRepoFactory();
    await monoRepoFactory.create();
  });

  beforeEach(async () => {
    repository = await repositoryFactory.cloneRepository();
    monoRepo = await monoRepoFactory.cloneRepository();
  });

  afterAll(async () => {
    await repository.cleanUp();
    await monoRepo.cleanUp();
  });

  describe('readChangelog', () => {
    it('adds actual commit hash', async () => {
      await repository.commitChange('foo');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 1',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        repository.rootPath
      );

      const currentHash = await repository.getCurrentHash();
      const changeSet = readChangeFiles({ path: repository.rootPath } as BeachballOptions);
      const changes = [...changeSet.values()];
      expect(changes).toHaveLength(1);
      expect(changes[0].commit).toBe(currentHash);
    });

    it('uses hash of original commit', async () => {
      const changeInfo: ChangeFileInfo = {
        comment: 'comment 1',
        date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
        email: 'test@testtestme.com',
        packageName: 'foo',
        type: 'patch',
        dependentChangeType: 'patch',
      };

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
      await repository.commitChange('foo');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 1',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        repository.rootPath
      );

      await repository.commitChange('bar');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 2',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        repository.rootPath
      );

      const beachballOptions = { path: repository.rootPath } as BeachballOptions;
      const changes = readChangeFiles(beachballOptions);

      // Gather all package info from package.json
      const packageInfos = getPackageInfos(repository.rootPath);

      writeChangelog(beachballOptions, changes, packageInfos);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = await readFileAsync(changelogFile, 'utf-8');

      const tree = parseMarkdown(text);
      const listItems = selectAll('listItem paragraph text', tree);

      expect(listItems.find(item => item.value === 'comment 2 (test@testtestme.com)')).toBeTruthy();
      expect(listItems.find(item => item.value === 'comment 1 (test@testtestme.com)')).toBeTruthy();
    });

    it('generates correct grouped changelog', async () => {
      await monoRepo.commitChange('foo');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 1',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        monoRepo.rootPath
      );

      await monoRepo.commitChange('bar');
      writeChangeFiles(
        {
          bar: {
            comment: 'comment 2',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'bar',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        monoRepo.rootPath
      );

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

      writeChangelog(beachballOptions, changes, packageInfos);

      // Validate changelog for foo package
      const fooChangelogFile = path.join(monoRepo.rootPath, 'packages', 'foo', 'CHANGELOG.md');
      const fooChangelogText = await readFileAsync(fooChangelogFile, 'utf-8');
      const fooChangelogTree = parseMarkdown(fooChangelogText);
      const fooChangelogHeadings = selectAll('heading text', fooChangelogTree);
      expect(fooChangelogHeadings.length).toEqual(3);
      expect(fooChangelogHeadings[0].value).toEqual('Change Log - foo');
      expect(fooChangelogHeadings[1].value).toEqual('1.0.0');
      expect(fooChangelogHeadings[2].value).toEqual('Patches');

      const fooChangelogListItems = selectAll('listItem paragraph text', fooChangelogTree);
      expect(fooChangelogListItems.length).toEqual(1);
      expect(fooChangelogListItems[0].value).toEqual('comment 1 (test@testtestme.com)');

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = await readFileAsync(barChangelogFile, 'utf-8');
      const barChangelogTree = parseMarkdown(barChangelogText);
      const barChangelogHeadings = selectAll('heading text', barChangelogTree);
      expect(barChangelogHeadings.length).toEqual(3);
      expect(barChangelogHeadings[0].value).toEqual('Change Log - bar');
      expect(barChangelogHeadings[1].value).toEqual('1.3.4');
      expect(barChangelogHeadings[2].value).toEqual('Patches');

      const barChangelogListItems = selectAll('listItem paragraph text', barChangelogTree);
      expect(barChangelogListItems.length).toEqual(1);
      expect(barChangelogListItems[0].value).toEqual('comment 2 (test@testtestme.com)');

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'CHANGELOG.md');
      const groupedChangelogText = await readFileAsync(groupedChangelogFile, 'utf-8');
      const groupedChangelogTree = parseMarkdown(groupedChangelogText);

      const groupedChangelogHeadings = selectAll('heading text', groupedChangelogTree);
      expect(groupedChangelogHeadings.length).toEqual(3);
      expect(groupedChangelogHeadings[0].value).toEqual('Change Log - foo');
      expect(groupedChangelogHeadings[1].value).toEqual('1.0.0');
      expect(groupedChangelogHeadings[2].value).toEqual('Patches');

      const groupedChangelogPackageNameListItems = selectAll('listItem paragraph inlineCode', groupedChangelogTree);
      expect(groupedChangelogPackageNameListItems.length).toEqual(2);
      expect(groupedChangelogPackageNameListItems[0].value).toEqual('bar');
      expect(groupedChangelogPackageNameListItems[1].value).toEqual('foo');

      const groupedChangelogCommentListItems = selectAll('listItem paragraph text', groupedChangelogTree);
      expect(groupedChangelogCommentListItems.length).toEqual(2);
      expect(groupedChangelogCommentListItems[0].value).toEqual('comment 2 (test@testtestme.com)');
      expect(groupedChangelogCommentListItems[1].value).toEqual('comment 1 (test@testtestme.com)');
    });

    it('generates correct grouped changelog when grouped change log is saved to the same dir as a regular changelog', async () => {
      await monoRepo.commitChange('foo');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 1',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        monoRepo.rootPath
      );

      await monoRepo.commitChange('bar');
      writeChangeFiles(
        {
          bar: {
            comment: 'comment 2',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'bar',
            type: 'patch',
            dependentChangeType: 'patch',
          },
        },
        monoRepo.rootPath
      );

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

      writeChangelog(beachballOptions, changes, packageInfos);

      // Validate changelog for bar package
      const barChangelogFile = path.join(monoRepo.rootPath, 'packages', 'bar', 'CHANGELOG.md');
      const barChangelogText = await readFileAsync(barChangelogFile, 'utf-8');
      const barChangelogTree = parseMarkdown(barChangelogText);
      const barChangelogHeadings = selectAll('heading text', barChangelogTree);
      expect(barChangelogHeadings.length).toEqual(3);
      expect(barChangelogHeadings[0].value).toEqual('Change Log - bar');
      expect(barChangelogHeadings[1].value).toEqual('1.3.4');
      expect(barChangelogHeadings[2].value).toEqual('Patches');

      const barChangelogListItems = selectAll('listItem paragraph text', barChangelogTree);
      expect(barChangelogListItems.length).toEqual(1);
      expect(barChangelogListItems[0].value).toEqual('comment 2 (test@testtestme.com)');

      // Validate grouped changelog for foo and bar packages
      const groupedChangelogFile = path.join(monoRepo.rootPath, 'packages', 'foo', 'CHANGELOG.md');
      const groupedChangelogText = await readFileAsync(groupedChangelogFile, 'utf-8');
      const groupedChangelogTree = parseMarkdown(groupedChangelogText);

      const groupedChangelogHeadings = selectAll('heading text', groupedChangelogTree);
      expect(groupedChangelogHeadings.length).toEqual(3);
      expect(groupedChangelogHeadings[0].value).toEqual('Change Log - foo');
      expect(groupedChangelogHeadings[1].value).toEqual('1.0.0');
      expect(groupedChangelogHeadings[2].value).toEqual('Patches');

      const groupedChangelogPackageNameListItems = selectAll('listItem paragraph inlineCode', groupedChangelogTree);
      expect(groupedChangelogPackageNameListItems.length).toEqual(2);
      expect(groupedChangelogPackageNameListItems[0].value).toEqual('bar');
      expect(groupedChangelogPackageNameListItems[1].value).toEqual('foo');

      const groupedChangelogCommentListItems = selectAll('listItem paragraph text', groupedChangelogTree);
      expect(groupedChangelogCommentListItems.length).toEqual(2);
      expect(groupedChangelogCommentListItems[0].value).toEqual('comment 2 (test@testtestme.com)');
      expect(groupedChangelogCommentListItems[1].value).toEqual('comment 1 (test@testtestme.com)');
    });
  });
});
