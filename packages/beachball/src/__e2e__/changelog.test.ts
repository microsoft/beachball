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
import { ChangeInfo } from '../types/ChangeInfo';

const readFileAsync = promisify(fs.readFile);

function parseMarkdown(markdown: string) {
  return unified()
    .use(remarkParse)
    .parse(markdown);
}

describe('changelog generation', () => {
  let repositoryFactory: RepositoryFactory;
  let repository: Repository;

  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  beforeEach(async () => {
    repository = await repositoryFactory.cloneRepository();
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
      const changeInfo: ChangeInfo = {
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
    it('generates changelog that is a valid markdown file', async () => {
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

      const changes = readChangeFiles({ path: repository.rootPath } as BeachballOptions);

      // Gather all package info from package.json
      const packageInfos = getPackageInfos(repository.rootPath);

      writeChangelog(changes, packageInfos);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = await readFileAsync(changelogFile, 'utf-8');

      const tree = parseMarkdown(text);
      const listItems = selectAll('listItem paragraph text', tree);

      expect(listItems.find(item => item.value === 'comment 2 (test@testtestme.com)')).toBeTruthy();
      expect(listItems.find(item => item.value === 'comment 1 (test@testtestme.com)')).toBeTruthy();
    });
  });
});
