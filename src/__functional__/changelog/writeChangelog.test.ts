import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs';
import semver from 'semver';
import { generateChangeFiles, getChange, fakeEmail as author } from '../../__fixtures__/changeFiles';
import {
  readChangelogJson,
  readChangelogMd,
  fakeCommit as commit,
  trimChangelogMd,
} from '../../__fixtures__/changelog';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { writeChangelog } from '../../changelog/writeChangelog';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { readChangeFiles } from '../../changefile/readChangeFiles';
import type { BeachballOptions, RepoOptions } from '../../types/BeachballOptions';
import type { Repository } from '../../__fixtures__/repository';
import type { BumpInfo } from '../../types/BumpInfo';
import { getMaxChangeType } from '../../changefile/changeTypes';
import { getChangePath } from '../../paths';
import { trimmedVersionsNote } from '../../changelog/renderChangelog';
import { getParsedOptions } from '../../options/getOptions';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import type { PackageInfos } from '../../types/PackageInfo';
import { writeJson } from '../../object/writeJson';
import { getScopedPackages } from '../../monorepo/getScopedPackages';

describe('writeChangelog', () => {
  let repositoryFactory: RepositoryFactory;
  let monoRepoFactory: RepositoryFactory;
  let repo: Repository | undefined;
  let sharedSingleRepo: Repository;
  let sharedMonoRepo: Repository;

  initMockLogs();

  function getOptionsAndPackages(repoOptions?: Partial<RepoOptions>, cwd?: string) {
    const parsedOptions = getParsedOptions({
      cwd: cwd || repo?.rootPath || '',
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName, ...repoOptions },
    });
    const packageInfos = getPackageInfos(parsedOptions.cliOptions);
    return { packageInfos, options: parsedOptions.options, parsedOptions };
  }

  /**
   * Read package infos and change files, fill in default options, bump versions in package info,
   * and call `writeChangelog`.
   *
   * `calculatedChangeTypes` will be generated based on the max change type of each package's change files,
   * and assuming every `dependentChangedBy` package has change type `patch`.
   *
   * The package info versions and package.json versions on disk (but not dependency ranges) will be
   * bumped based on the `calculatedChangeTypes`, so that the changelog results are more realistic,
   * and tests involving multiple bumps work more realistically.
   */
  async function writeChangelogWrapper(
    params: Partial<Pick<BumpInfo, 'dependentChangedBy'>> & {
      packageInfos: PackageInfos;
      options: BeachballOptions;
    }
  ) {
    const { options, dependentChangedBy = {}, packageInfos } = params;
    const changeFileChangeInfos = readChangeFiles(options, packageInfos, getScopedPackages(options, packageInfos));

    // Generate a basic best guess at calculatedChangeTypes
    const calculatedChangeTypes: BumpInfo['calculatedChangeTypes'] = {};
    for (const { change } of changeFileChangeInfos) {
      const { packageName, type } = change;
      calculatedChangeTypes[packageName] = getMaxChangeType([type, calculatedChangeTypes[packageName]]);
    }
    for (const pkgName of Object.keys(dependentChangedBy)) {
      calculatedChangeTypes[pkgName] = getMaxChangeType(['patch', calculatedChangeTypes[pkgName]]);
    }

    // Bump versions in package info and package.json for more realistic changelogs.
    // (This is a much more basic variant of the usual bump process.)
    for (const [pkgName, changeType] of Object.entries(calculatedChangeTypes)) {
      packageInfos[pkgName].version = semver.inc(packageInfos[pkgName].version, changeType as semver.ReleaseType)!;
      const { packageJsonPath, ...packageJson } = packageInfos[pkgName];
      writeJson(packageJsonPath, packageJson);
    }

    await writeChangelog({ dependentChangedBy, calculatedChangeTypes, changeFileChangeInfos, packageInfos }, options);
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

  it('does not write changelogs if there are no changes', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages();

    await writeChangelogWrapper({ options, packageInfos });

    expect(readChangelogMd(repo.rootPath)).toBeNull();
    expect(readChangelogJson(repo.rootPath)).toBeNull();
  });

  it('generates basic changelog (md only by default)', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages();

    generateChangeFiles([getChange('foo', 'old minor comment')], options);
    generateChangeFiles([getChange('foo', 'patch comment', 'patch')], options);
    generateChangeFiles([getChange('foo', 'no comment', 'none')], options);
    generateChangeFiles([getChange('foo', 'new minor comment', 'minor')], options);

    await writeChangelogWrapper({ options, packageInfos });

    const changelogMd = readChangelogMd(repo.rootPath);
    // Do some explicit tests since snapshot changes are too easy to ignore
    expect(changelogMd).toMatch(/^# Change Log - foo/);
    expect(changelogMd).toMatch(/### Minor changes\n\n- new minor comment.*\n- old minor comment/);
    expect(changelogMd).toContain('### Patches\n\n- patch comment');
    expect(changelogMd).not.toContain('no comment');
    expect(changelogMd).toMatchSnapshot('changelog md');

    const changelogJson = readChangelogJson(repo.rootPath);
    expect(changelogJson).toBeNull();
  });

  it('generates basic changelog md and json if generateChangelog is true', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages({ generateChangelog: true });

    generateChangeFiles([getChange('foo', 'old minor comment')], options);
    generateChangeFiles([getChange('foo', 'patch comment', 'patch')], options);
    generateChangeFiles([getChange('foo', 'no comment', 'none')], options);
    generateChangeFiles([getChange('foo', 'new minor comment', 'minor')], options);

    await writeChangelogWrapper({ options, packageInfos });

    const changelogMd = readChangelogMd(repo.rootPath);
    // Just verify that this one was written (prevoius test covered details)
    expect(changelogMd).toMatch(/^# Change Log - foo/);

    const changelogJson = readChangelogJson(repo.rootPath);
    expect(changelogJson).toEqual({ name: 'foo', entries: [expect.anything()] });
    expect(changelogJson!.entries[0]).toEqual({
      version: '1.1.0',
      date: '(date)',
      tag: 'foo_v1.1.0',
      comments: {
        minor: [
          { comment: 'new minor comment', package: 'foo', author, commit },
          { comment: 'old minor comment', package: 'foo', author, commit },
        ],
        patch: [{ comment: 'patch comment', package: 'foo', author, commit }],
        none: [{ comment: 'no comment', package: 'foo', author, commit }],
      },
    });

    // Every entry should have a different commit hash
    const nonTransformedJson = readChangelogJson(repo.rootPath, undefined, true /* noTransform */);
    const minorComments = nonTransformedJson!.entries[0].comments.minor!;
    expect(minorComments).toBeTruthy();
    const commits = minorComments.map(entry => entry.commit);
    expect(new Set(commits).size).toEqual(minorComments.length);

    // The first entry should be the newest
    expect(minorComments[0].commit).toBe(repo.getCurrentHash());
  });

  it('generates changelog with custom changeDir', async () => {
    repo = sharedSingleRepo;
    const changeDir = 'myChangeDir';
    const { options, packageInfos } = getOptionsAndPackages({ changeDir });

    generateChangeFiles([{ packageName: 'foo', comment: 'comment 1' }], options);
    // make sure the setup worked as expected
    expect(fs.readdirSync(repo.pathTo(changeDir))).toEqual([expect.stringMatching(/^foo-.*\.json$/)]);

    await writeChangelogWrapper({ options, packageInfos });

    // Just check for a comment in the md to verify that the change file was found
    expect(readChangelogMd(repo.rootPath)).toContain('### Minor changes\n\n- comment 1');
  });

  it('generates changelogs with dependent changes in monorepo', async () => {
    repo = sharedMonoRepo;
    const { options, packageInfos } = getOptionsAndPackages({ generateChangelog: true });

    generateChangeFiles([{ packageName: 'foo', comment: 'foo comment' }], options);
    generateChangeFiles([{ packageName: 'baz', comment: 'baz comment' }], options);

    await writeChangelogWrapper({
      options,
      packageInfos,
      // Per the fixture, bar depends on baz (and is bumped), and foo depends on bar.
      // Note that the changelogs will only include dependent bump entries as specified here
      // (which may be different than what would actually be calculated while bumping), and
      // NO actual bumping will occur (so the versions will be the same as the fixture).
      dependentChangedBy: { bar: new Set(['baz']), foo: new Set(['bar']) },
    });

    // check changelogs for foo, bar, and baz
    const fooText = readChangelogMd(repo.pathTo('packages/foo'));
    expect(fooText).toMatch(/### Minor changes\n\n- foo comment.*\n- Bump bar to/);
    expect(fooText).not.toContain('baz comment');
    expect(fooText).toMatchSnapshot('foo CHANGELOG.md');

    const barText = readChangelogMd(repo.pathTo('packages/bar'));
    expect(barText).toContain('### Patches\n\n- Bump baz to');
    expect(barText).not.toMatch(/(foo|baz) comment/);
    expect(barText).toMatchSnapshot('bar CHANGELOG.md');

    const bazText = readChangelogMd(repo.pathTo('packages/baz'));
    expect(bazText).toContain('baz comment');
    expect(bazText).not.toContain('Bump');
    expect(bazText).toMatchSnapshot('baz CHANGELOG.md');

    const fooJson = readChangelogJson(repo.pathTo('packages/foo'));
    expect(fooJson).toEqual({ name: 'foo', entries: [expect.anything()] });
    expect(fooJson!.entries[0]).toEqual({
      version: '1.1.0',
      date: '(date)',
      tag: 'foo_v1.1.0',
      comments: {
        minor: [
          { package: 'foo', comment: 'foo comment', author, commit },
          { package: 'foo', comment: 'Bump bar to v1.3.5', author: 'beachball', commit },
        ],
      },
    });

    const barJson = readChangelogJson(repo.pathTo('packages/bar'));
    expect(barJson).toEqual({ name: 'bar', entries: [expect.anything()] });
    expect(barJson!.entries[0]).toEqual({
      comments: {
        patch: [{ package: 'bar', comment: 'Bump baz to v1.4.0', author: 'beachball', commit }],
      },
      date: '(date)',
      tag: 'bar_v1.3.5',
      version: '1.3.5',
    });

    const bazJson = readChangelogJson(repo.pathTo('packages/baz'));
    expect(bazJson).toEqual({ name: 'baz', entries: [expect.anything()] });
    expect(bazJson!.entries[0]).toEqual({
      version: '1.4.0',
      date: '(date)',
      tag: 'baz_v1.4.0',
      comments: {
        minor: [{ package: 'baz', comment: 'baz comment', author, commit }],
      },
    });
  });

  it('generates changelog in monorepo with grouped change files (groupChanges)', async () => {
    repo = sharedMonoRepo;
    const { options, packageInfos } = getOptionsAndPackages({ groupChanges: true, generateChangelog: true });

    // these will be in one change file
    generateChangeFiles([getChange('foo', 'comment 2'), getChange('bar', 'bar comment')], options);
    // separate change file
    generateChangeFiles([getChange('foo', 'comment 1')], options);

    await writeChangelogWrapper({ options, packageInfos, dependentChangedBy: { foo: new Set(['bar']) } });

    // check changelogs for both foo and bar
    const fooText = readChangelogMd(repo.pathTo('packages/foo'));
    expect(fooText).toMatch(/- comment 1.*\n- comment 2/);
    expect(fooText).not.toContain('bar comment');

    const barText = readChangelogMd(repo.pathTo('packages/bar'));
    expect(barText).toContain('bar comment');
    expect(barText).not.toMatch(/comment (1|2)/);

    const fooJson = readChangelogJson(repo.pathTo('packages/foo'));
    expect(fooJson).toEqual({ name: 'foo', entries: [expect.anything()] });
    expect(fooJson!.entries[0].comments).toEqual({
      minor: [
        expect.objectContaining({ comment: 'comment 1', package: 'foo' }),
        expect.objectContaining({ comment: 'comment 2', package: 'foo' }),
        expect.objectContaining({ comment: 'Bump bar to v1.4.0', package: 'foo' }),
      ],
    });

    const barJson = readChangelogJson(repo.pathTo('packages/bar'));
    expect(barJson).toEqual({ name: 'bar', entries: [expect.anything()] });
    expect(barJson!.entries[0].comments).toEqual({
      minor: [expect.objectContaining({ comment: 'bar comment', package: 'bar' })],
    });
  });

  it('generates grouped changelog in monorepo', async () => {
    repo = sharedMonoRepo;
    const { options, packageInfos } = getOptionsAndPackages({
      generateChangelog: true,
      changelog: {
        groups: [
          {
            mainPackageName: 'foo',
            changelogPath: '.',
            include: ['packages/*'],
          },
        ],
      },
    });

    // foo and baz have changes.
    // bar has no direct changes, but it depends on baz.
    generateChangeFiles(['foo', 'baz'], options);
    generateChangeFiles([getChange('foo', 'foo comment 2')], options);

    await writeChangelogWrapper({
      options,
      packageInfos,
      // Per the fixture structure, bar will have a dependent change from baz, which changes foo
      dependentChangedBy: { bar: new Set(['baz']), foo: new Set(['bar']) },
    });

    // Validate package changelogs
    const fooText = readChangelogMd(repo.pathTo('packages/foo'));
    // includes the dependent change from bar
    expect(fooText).toMatch(/- foo comment.*\n- Bump bar to/);
    expect(fooText).not.toContain('baz comment');

    const barText = readChangelogMd(repo.pathTo('packages/bar'));
    // includes the dependent change from baz
    expect(barText).toContain('Bump baz to');
    expect(barText).not.toMatch(/(foo|baz) comment/);

    const bazText = readChangelogMd(repo.pathTo('packages/baz'));
    expect(bazText).toContain('baz comment');
    expect(bazText).not.toMatch(/Bump|foo comment/);

    // Verify that dependent entries are in foo CHANGELOG.json
    const fooJson = readChangelogJson(repo.pathTo('packages/foo'));
    expect(fooJson).toEqual({ name: 'foo', entries: [expect.anything()] });
    expect(fooJson!.entries[0].comments.minor).toContainEqual(
      expect.objectContaining({ comment: 'Bump bar to v1.3.5' })
    );

    // Validate grouped changelog: it shouldn't have dependent entries
    const groupedText = readChangelogMd(repo.rootPath);
    expect(groupedText).not.toContain('Bump');
    expect(groupedText).toMatch(/- `foo`.*\n  - foo comment 2.*\n  - foo comment/);
    expect(groupedText).toMatch(/- `baz`.*\n  - baz comment/);
    expect(groupedText).toMatchSnapshot('grouped CHANGELOG.md');

    // Validate grouped CHANGELOG.json
    const groupedJson = readChangelogJson(repo.rootPath);
    expect(groupedJson).toEqual({ name: 'foo', entries: [expect.anything()] });
    expect(groupedJson!.entries[0]).toEqual({
      comments: {
        minor: [
          { comment: 'foo comment 2', package: 'foo', author, commit },
          { comment: 'foo comment', package: 'foo', author, commit },
          { comment: 'baz comment', package: 'baz', author, commit },
        ],
      },
      date: '(date)',
      tag: 'foo_v1.1.0',
      version: '1.1.0',
    });
  });

  it('generates grouped changelog when path overlaps with regular changelog', async () => {
    repo = sharedMonoRepo;
    const { options, packageInfos } = getOptionsAndPackages({
      generateChangelog: true,
      changelog: {
        groups: [
          {
            mainPackageName: 'foo',
            changelogPath: 'packages/foo',
            include: ['packages/foo', 'packages/bar'],
          },
        ],
      },
    });

    generateChangeFiles(['foo', 'bar'], options);

    await writeChangelogWrapper({ options, packageInfos, dependentChangedBy: { foo: new Set(['bar']) } });

    // packages/foo changelog should be grouped, not regular.
    // We can verify this by just looking for the bar entry.
    const groupedChangelogMd = readChangelogMd(repo.pathTo('packages/foo'));
    expect(groupedChangelogMd).toContain('- `bar`\n  - bar comment');

    const groupedJson = readChangelogJson(repo.pathTo('packages/foo'));
    expect(groupedJson).toEqual({ name: 'foo', entries: [expect.anything()] });
    expect(groupedJson!.entries[0].comments.minor).toContainEqual(expect.objectContaining({ comment: 'bar comment' }));
  });

  it('does not write grouped changelog if group would only have dependent bumps', async () => {
    repo = sharedMonoRepo;
    const { options, packageInfos } = getOptionsAndPackages({
      changelog: {
        groups: [{ mainPackageName: 'foo', changelogPath: '.', include: ['packages/foo', 'packages/baz'] }],
      },
    });

    // bar is not in the group, but it causes a dependent change for foo
    generateChangeFiles(['bar'], options);
    await writeChangelogWrapper({ options, packageInfos, dependentChangedBy: { foo: new Set(['bar']) } });

    // grouped changelog was not written
    expect(readChangelogMd(repo.rootPath)).toBeNull();
    expect(readChangelogJson(repo.rootPath)).toBeNull();

    // foo changelog was written with the dependent bump
    expect(readChangelogMd(repo.pathTo('packages/foo'))).toBeTruthy();
  });

  it('does not write grouped changelog overlapping regular changelog if it would contain only dependent bumps', async () => {
    repo = sharedMonoRepo;
    const { options, packageInfos } = getOptionsAndPackages({
      changelog: {
        groups: [
          // The grouped changelog overlaps with the changelog for packages/foo.
          { mainPackageName: 'foo', changelogPath: 'packages/foo', include: ['packages/foo', 'packages/baz'] },
        ],
      },
    });

    // bar is not in the group
    generateChangeFiles(['bar'], options);
    // but it causes a dependent change for foo (so normally foo's non-grouped changelog would be written)
    await writeChangelogWrapper({ options, packageInfos, dependentChangedBy: { foo: new Set(['bar']) } });

    // Nothing was written (not the grouped changelog, and not a normal changelog for foo)
    expect(readChangelogMd(repo.pathTo('packages/foo'))).toBeNull();
    expect(readChangelogJson(repo.pathTo('packages/foo'))).toBeNull();
  });

  it('includes pre* changes', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages();

    generateChangeFiles(
      [
        { packageName: 'foo', comment: 'comment 1', type: 'premajor' },
        { packageName: 'foo', comment: 'comment 2', type: 'preminor' },
        { packageName: 'foo', comment: 'comment 3', type: 'prepatch' },
        { packageName: 'foo', comment: 'comment 4', type: 'prerelease' },
      ],
      options
    );

    await writeChangelogWrapper({ options, packageInfos });

    const changelogMd = readChangelogMd(repo.rootPath);
    expect(changelogMd).toContain('### Major changes (pre-release)\n\n- comment 1');
    expect(changelogMd).toContain('### Minor changes (pre-release)\n\n- comment 2');
    expect(changelogMd).toContain('### Patches (pre-release)\n\n- comment 3');
    expect(changelogMd).toContain('### Changes\n\n- comment 4');
  });

  it('includes pre* changes', async () => {
    repo = repositoryFactory.cloneRepository();
    const { options, packageInfos } = getOptionsAndPackages();

    generateChangeFiles(
      [
        getChange('foo', 'comment 1', 'premajor'),
        getChange('foo', 'comment 2', 'preminor'),
        getChange('foo', 'comment 3', 'prepatch'),
      ],
      options
    );

    await writeChangelogWrapper({ options, packageInfos });

    const changelogMd = readChangelogMd(repo.rootPath);
    expect(changelogMd).toContain('### Major changes (pre-release)\n\n- comment 1');
    expect(changelogMd).toContain('### Minor changes (pre-release)\n\n- comment 2');
    expect(changelogMd).toContain('### Patches (pre-release)\n\n- comment 3');
  });

  it('writes only CHANGELOG.md if generateChangelog is "md"', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages({ generateChangelog: 'md' });

    generateChangeFiles(['foo'], options);

    await writeChangelogWrapper({ options, packageInfos });

    // CHANGELOG.md is written
    expect(readChangelogMd(repo.rootPath)).toContain('## 1.1.0');

    // CHANGELOG.json is not written
    expect(readChangelogJson(repo.rootPath)).toBeNull();
  });

  it('writes only CHANGELOG.json if generateChangelog is "json"', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages({ generateChangelog: 'json' });

    generateChangeFiles(['foo'], options);

    await writeChangelogWrapper({ options, packageInfos });

    // CHANGELOG.md is not written
    expect(readChangelogMd(repo.rootPath)).toBeNull();

    // CHANGELOG.json is written
    const changelogJson = readChangelogJson(repo.rootPath);
    expect(changelogJson).not.toBeNull();
    expect(changelogJson!.entries[0].comments.minor).toEqual([expect.objectContaining({ comment: 'foo comment' })]);
  });

  it('appends to existing changelog', async () => {
    // Most of the previous content tests are handled by renderChangelog, but writeChangelog is
    // responsible for reading that content and passing it in.
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages({ generateChangelog: true });

    // Write some changes and generate changelogs
    generateChangeFiles(['foo'], options);
    await writeChangelogWrapper({ options, packageInfos });

    // Read and save the initial changelogs
    const firstChangelogMd = readChangelogMd(repo.rootPath);
    expect(firstChangelogMd).toContain('foo comment');
    const firstChangelogJson = readChangelogJson(repo.rootPath);
    expect(firstChangelogJson).toEqual({ name: 'foo', entries: [expect.anything()] });

    // Delete the change files, generate new ones, and re-generate changelogs
    fs.rmSync(getChangePath(options), { recursive: true, force: true });
    generateChangeFiles([getChange('foo', 'extra change')], options);
    await writeChangelogWrapper({ options, packageInfos });

    // Read the changelogs again and verify that the previous content is still there
    const secondChangelogMd = readChangelogMd(repo.rootPath);
    expect(secondChangelogMd).toContain('extra change');
    expect(secondChangelogMd).toContain(trimChangelogMd(firstChangelogMd!));

    const secondChangelogJson = readChangelogJson(repo.rootPath);
    expect(secondChangelogJson).toEqual({
      name: 'foo',
      entries: [expect.anything(), firstChangelogJson!.entries[0]],
    });
  });

  it('appends to existing changelog when migrating from uniqueFilenames=false to true', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages({ generateChangelog: true });

    // Write some changes and generate changelogs
    generateChangeFiles(['foo'], options);
    await writeChangelogWrapper({ options, packageInfos });

    // Read and save the initial changelogs
    const firstChangelogMd = readChangelogMd(repo.rootPath);
    expect(firstChangelogMd).toContain('foo comment');
    const firstChangelogJson = readChangelogJson(repo.rootPath);
    expect(firstChangelogJson).toEqual({ name: 'foo', entries: [expect.anything()] });

    // Delete the initial change files
    fs.rmSync(getChangePath(options), { recursive: true, force: true });

    // Change the options to used suffixed filenames, generate new change files, and re-generate changelogs
    options.changelog = { uniqueFilenames: true };
    generateChangeFiles([getChange('foo', 'extra change')], options);
    await writeChangelogWrapper({ options, packageInfos });

    // Verify the old changelog is moved
    expect(readChangelogMd(repo.rootPath)).toBeNull();

    // Read the changelogs again and verify that the previous content is still there
    // ("acbd18db" is the start of the md5 hash digest of "foo")
    const secondChangelogMd = readChangelogMd(repo.rootPath, 'CHANGELOG-acbd18db.md');
    expect(secondChangelogMd).toContain('extra change');
    expect(secondChangelogMd).toContain(trimChangelogMd(firstChangelogMd!));

    const secondChangelogJson = readChangelogJson(repo.rootPath, 'CHANGELOG-acbd18db.json');
    expect(secondChangelogJson).toEqual({
      name: 'foo',
      entries: [expect.anything(), firstChangelogJson!.entries[0]],
    });
  });

  it('trims previous changelog entries over maxVersions', async () => {
    repo = sharedSingleRepo;
    const { options, packageInfos } = getOptionsAndPackages({
      generateChangelog: true,
      changelog: { maxVersions: 2 },
    });

    // Bump and write three times
    for (let i = 1; i <= 3; i++) {
      fs.rmSync(getChangePath(options), { recursive: true, force: true });
      generateChangeFiles([{ packageName: 'foo', comment: `foo comment ${i}` }], options);
      await writeChangelogWrapper({ options, packageInfos });
    }

    // Read the changelog md and verify that it only has the last two versions
    const changelogMd = readChangelogMd(repo.rootPath);
    expect(changelogMd).toContain('## 1.3.0');
    expect(changelogMd).toContain('## 1.2.0');
    expect(changelogMd).not.toContain('## 1.1.0');
    expect(changelogMd).toContain(trimmedVersionsNote);
    // Do a snapshot to make sure there's no funny formatting
    expect(changelogMd).toMatchSnapshot('CHANGELOG.md');

    // Same with changelog json
    const changelogJson = readChangelogJson(repo.rootPath);
    expect(changelogJson!.entries).toHaveLength(2);
  });
});
