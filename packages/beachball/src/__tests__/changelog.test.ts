import path from 'path';
import fs from 'fs';

import { promisify } from 'util';

import { RepositoryFactory, Repository } from '../fixtures/repository';
import { writeChangelog } from '../changelog';

import { writeChangeFiles } from '../changefile';
import { getPublicPackageInfos } from '../monorepo';

import unified from 'unified';
import remarkParse from 'remark-parse';
import { selectAll } from 'unist-util-select';

const readFileAsync = promisify(fs.readFile);

function parseMarkdown(markdown: string) {
  return unified()
    .use(remarkParse)
    .parse(markdown);
}

describe('validation', () => {
  let repositoryFactory: RepositoryFactory;
  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  describe('writeChangelog', () => {
    let repository: Repository;

    beforeEach(async () => {
      repository = await repositoryFactory.cloneRepository();
    });

    it('generate changelog is a valid markdown file', async () => {
      await repository.commitChange('foo');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 1',
            commit: 'sha1-1',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch'
          }
        },
        repository.rootPath
      );

      await repository.commitChange('bar');
      writeChangeFiles(
        {
          foo: {
            comment: 'comment 2',
            commit: 'sha1-2',
            date: new Date('Thu Aug 22 2019 14:20:40 GMT-0700 (Pacific Daylight Time)'),
            email: 'test@testtestme.com',
            packageName: 'foo',
            type: 'patch'
          }
        },
        repository.rootPath
      );

      // Gather all package info from package.json
      const packageInfos = getPublicPackageInfos(repository.rootPath);

      writeChangelog(packageInfos, repository.rootPath);

      const changelogFile = path.join(repository.rootPath, 'CHANGELOG.md');
      const text = await readFileAsync(changelogFile, 'utf-8');

      const tree = parseMarkdown(text);
      const listItems = selectAll('listItem paragraph text', tree);

      expect(listItems.find(item => item.value === 'comment 2 (test@testtestme.com)')).toBeTruthy();
      expect(listItems.find(item => item.value === 'comment 1 (test@testtestme.com)')).toBeTruthy();
    });
  });
});
