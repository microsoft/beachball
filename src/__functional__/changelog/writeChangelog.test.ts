import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import { generateChangeFiles } from '../../__fixtures__/changeFiles';
import { cleanChangelogJson, readChangelogJson, readChangelogMd } from '../../__fixtures__/changelog';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';

import { writeChangelog } from '../../changelog/writeChangelog';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import { BeachballOptions } from '../../types/BeachballOptions';
import { ChangeFileInfo, ChangeType } from '../../types/ChangeInfo';
import type { Repository } from '../../__fixtures__/repository';
import { getDefaultOptions } from '../../options/getDefaultOptions';

function getChange(packageName: string, comment: string, type: ChangeType = 'patch'): ChangeFileInfo {
  return {
    comment,
    email: 'test@testtestme.com',
    packageName,
    type,
    dependentChangeType: 'patch',
  };
}

describe('writeChangelog', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: RepositoryFactory;
  let repo: Repository | undefined;

  initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      // change to ?. if a future test uses a non-standard repo
      path: repo!.rootPath,
      ...options,
    };
  }

  beforeAll(() => {
    // These tests can share the same repo factories because they don't push to origin
    // (the actual tests run against a clone)
    repositoryFactory = new RepositoryFactory('single');
    monoRepoFactory = new RepositoryFactory('monorepo');
  });

  afterEach(() => {
    repo = undefined;
  });

  afterAll(() => {
    repositoryFactory.cleanUp();
    monoRepoFactory.cleanUp();
  });

  it('generates correct changelog', async () => {
    repo = repositoryFactory.cloneRepository();
    const options = getOptions();

    repo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'additional comment 2')], options);
    generateChangeFiles([getChange('foo', 'additional comment 1')], options);
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    repo.commitChange('bar');
    generateChangeFiles([getChange('foo', 'comment 2')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

    expect(readChangelogMd(repo.rootPath)).toMatchSnapshot('changelog md');

    const changelogJson = readChangelogJson(repo.rootPath);
    expect(cleanChangelogJson(changelogJson)).toMatchSnapshot('changelog json');

    // Every entry should have a different commit hash
    const patchComments = changelogJson!.entries[0].comments.patch!;
    const commits = patchComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(patchComments.length);

    // The first entry should be the newest
    expect(patchComments[0].commit).toBe(repo.getCurrentHash());
  });

  it('generates correct changelog with changeDir set', async () => {
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      changeDir: 'myChangeDir',
    });

    repo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'additional comment 2')], options);
    generateChangeFiles([getChange('foo', 'additional comment 1')], options);
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    repo.commitChange('bar');
    generateChangeFiles([getChange('foo', 'comment 2')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

    expect(readChangelogMd(repo.rootPath)).toMatchSnapshot('changelog md');

    const changelogJson = readChangelogJson(repo.rootPath);
    expect(cleanChangelogJson(changelogJson)).toMatchSnapshot('changelog json');

    // Every entry should have a different commit hash
    const patchComments = changelogJson!.entries[0].comments.patch!;
    const commits = patchComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(patchComments.length);

    // The first entry should be the newest
    expect(patchComments[0].commit).toBe(repo.getCurrentHash());
  });

  it('generates correct changelog in monorepo with groupChanges (grouped change FILES)', async () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({
      groupChanges: true,
    });

    repo.commitChange('foo');
    generateChangeFiles(
      [getChange('foo', 'additional comment 2'), getChange('bar', 'comment from bar change ')],
      options
    );
    generateChangeFiles([getChange('foo', 'additional comment 1')], options);
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    repo.commitChange('bar');
    generateChangeFiles([getChange('foo', 'comment 2')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { foo: 'patch', bar: 'patch' }, {}, packageInfos);

    // check changelogs for both foo and bar
    expect(readChangelogMd(repo.pathTo('packages/foo'))).toMatchSnapshot('foo CHANGELOG.md');
    expect(readChangelogMd(repo.pathTo('packages/bar'))).toMatchSnapshot('bar CHANGELOG.md');

    const fooJson = readChangelogJson(repo.pathTo('packages/foo'));
    expect(cleanChangelogJson(fooJson)).toMatchSnapshot('foo CHANGELOG.json');
    expect(readChangelogJson(repo.pathTo('packages/bar'), true /*clean*/)).toMatchSnapshot('bar CHANGELOG.json');

    // Every entry should have a different commit hash
    const patchComments = fooJson!.entries[0].comments.patch!;
    const commits = patchComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(patchComments.length);

    // The first entry should be the newest
    expect(patchComments[0].commit).toBe(repo.getCurrentHash());
  });

  it('generates correct grouped changelog in monorepo', async () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: repo.rootPath,
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    });

    repo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    repo.commitChange('bar');
    generateChangeFiles([getChange('bar', 'comment 2')], options);
    generateChangeFiles([getChange('bar', 'comment 3')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, {}, {}, packageInfos);

    // Validate changelog for foo and bar packages
    expect(readChangelogMd(repo.pathTo('packages/foo'))).toMatchSnapshot('foo CHANGELOG.md');
    expect(readChangelogMd(repo.pathTo('packages/bar'))).toMatchSnapshot('bar CHANGELOG.md');

    // Validate grouped changelog for foo and bar packages
    expect(readChangelogMd(repo.rootPath)).toMatchSnapshot('grouped CHANGELOG.md');
  });

  it('generates grouped changelog without dependent change entries', async () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: repo.rootPath,
            include: ['packages/foo', 'packages/bar', 'packages/baz'],
          },
        ],
      },
    });

    repo.commitChange('baz');
    generateChangeFiles([getChange('baz', 'comment 1')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { bar: 'patch', baz: 'patch' }, { bar: new Set(['baz']) }, packageInfos);

    // Validate changelog for bar package
    const barChangelogText = readChangelogMd(repo.pathTo('packages/bar'));
    expect(barChangelogText).toContain('- Bump baz');
    expect(barChangelogText).toMatchSnapshot('bar CHANGELOG.md');

    // Validate changelog for baz package
    expect(readChangelogMd(repo.pathTo('packages/baz'))).toMatchSnapshot('baz CHANGELOG.md');

    // Validate grouped changelog for foo master package
    const groupedChangelogText = readChangelogMd(repo.rootPath);
    expect(groupedChangelogText).toContain('- comment 1');
    expect(groupedChangelogText).not.toContain('- Bump baz');
    expect(groupedChangelogText).toMatchSnapshot('grouped CHANGELOG.md');
  });

  it('generates grouped changelog without dependent change entries where packages have normal changes and dependency changes', async () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({
      changelog: {
        groups: [
          {
            masterPackageName: 'foo',
            changelogPath: repo.rootPath,
            include: ['packages/foo', 'packages/bar', 'packages/baz'],
          },
        ],
      },
    });

    repo.commitChange('baz');
    generateChangeFiles([getChange('baz', 'comment 1')], options);
    generateChangeFiles([getChange('bar', 'comment 1')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { bar: 'patch', baz: 'patch' }, { bar: new Set(['baz']) }, packageInfos);

    // Validate changelog for bar and baz packages
    expect(readChangelogMd(repo.pathTo('packages/bar'))).toMatchSnapshot('bar CHANGELOG.md');
    expect(readChangelogMd(repo.pathTo('packages/baz'))).toMatchSnapshot('baz CHANGELOG.md');

    // Validate grouped changelog for foo master package
    expect(readChangelogMd(repo.rootPath)).toMatchSnapshot('grouped CHANGELOG.md');
  });

  it('generates correct grouped changelog when grouped change log is saved to the same dir as a regular changelog', async () => {
    repo = monoRepoFactory.cloneRepository();

    const options = getOptions({
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
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    repo.commitChange('bar');
    generateChangeFiles([getChange('bar', 'comment 2')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, {}, {}, packageInfos);

    // Validate changelog for bar package
    expect(readChangelogMd(repo.pathTo('packages/bar'))).toMatchSnapshot();

    // Validate grouped changelog for foo and bar packages
    expect(readChangelogMd(repo.pathTo('packages/foo'))).toMatchSnapshot();
  });

  it('includes pre* changes', async () => {
    repo = repositoryFactory.cloneRepository();
    const options = getOptions();

    generateChangeFiles(
      [
        { packageName: 'foo', comment: 'comment 1', type: 'premajor' },
        { packageName: 'foo', comment: 'comment 2', type: 'preminor' },
        { packageName: 'foo', comment: 'comment 3', type: 'prepatch' },
      ],
      options
    );

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);
    await writeChangelog(options, changes, {}, {}, packageInfos);

    const changelogMd = readChangelogMd(repo.rootPath);
    expect(changelogMd).toContain('### Major changes (pre-release)\n\n- comment 1');
    expect(changelogMd).toContain('### Minor changes (pre-release)\n\n- comment 2');
    expect(changelogMd).toContain('### Patches (pre-release)\n\n- comment 3');
  });

  it('writes only CHANGELOG.md if generateChangelog is "md"', async () => {
    repo = repositoryFactory.cloneRepository();
    const options = getOptions({ generateChangelog: 'md' });

    repo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

    // CHANGELOG.md is written
    expect(readChangelogMd(repo.rootPath)).toContain('## 1.0.0');

    // CHANGELOG.json is not written
    expect(readChangelogJson(repo.rootPath)).toBeNull();
  });

  it('writes only CHANGELOG.json if generateChangelog is "json"', async () => {
    repo = repositoryFactory.cloneRepository();
    const options = getOptions({ generateChangelog: 'json' });

    repo.commitChange('foo');
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    const packageInfos = getPackageInfos(repo.rootPath);
    const changes = readChangeFiles(options, packageInfos);

    await writeChangelog(options, changes, { foo: 'patch' }, { foo: new Set(['foo']) }, packageInfos);

    // CHANGELOG.md is not written
    expect(readChangelogMd(repo.rootPath)).toBeNull();

    // CHANGELOG.json is written
    const changelogJson = readChangelogJson(repo.rootPath);
    expect(changelogJson).not.toBeNull();
    expect(changelogJson!.entries[0].comments.patch).toEqual([expect.objectContaining({ comment: 'comment 1' })]);
  });
});
