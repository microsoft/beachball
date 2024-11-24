import { describe, expect, it, afterEach, jest } from '@jest/globals';
import path from 'path';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { readChangelogJson, readChangelogMd } from '../__fixtures__/changelog';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { HooksOptions, ParsedOptions, RepoOptions } from '../types/BeachballOptions';
import type { Repository } from '../__fixtures__/repository';
import type { PackageJson } from '../types/PackageInfo';
import { getParsedOptions } from '../options/getOptions';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { readJson } from '../object/readJson';
import { validate } from '../validation/validate';
import { createCommandContext } from '../monorepo/createCommandContext';
import type { CommandContext } from '../types/CommandContext';
import type { BumpInfo } from '../types/BumpInfo';
import { deepFreeze } from '../__fixtures__/object';
import { catalogsToYaml, type Catalogs } from 'workspace-tools';

//
// These tests use git repos and are slow, so besides a few basic scenarios, this file should
// only contain cases that can't be realistically tested in memory only.
// Most scenarios for version bumps should be tested in bumpInMemory.test.ts instead.
//
describe('bump command', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  initMockLogs();

  /**
   * Get options. Defaults to the repository root as cwd.
   * Defaults to `fetch: false` since fetching is rarely relevant for these tests and is slow.
   */
  function getOptions(repoOptions?: Partial<RepoOptions>, cwd?: string) {
    const parsedOptions = getParsedOptions({
      cwd: cwd || repo?.rootPath || '',
      argv: [],
      testRepoOptions: {
        branch: defaultRemoteBranchName,
        fetch: false,
        generateChangelog: true, // generate JSON changelogs by default since several tests use them
        ...repoOptions,
      },
    });
    return { options: parsedOptions.options, parsedOptions };
  }

  /**
   * For more realistic testing, call `validate()` like the CLI command does, then call `bump()`.
   * This helps catch any new issues with double bumps or context mutation.
   * @returns the context containing the bump info
   */
  async function bumpWrapper(parsedOptions: ParsedOptions) {
    // This does an initial bump
    const { context } = validate(parsedOptions, { checkDependencies: true });
    // Ensure the later bump process does not modify the context
    deepFreeze(context);
    await bump(parsedOptions.options, context);
    return context as CommandContext & { bumpInfo: BumpInfo };
  }

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
    repo = undefined;
  });

  it('bumps only packages with change files with bumpDeps: false', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: false,
    });
    const comment = 'test comment for pkg-1';
    generateChangeFiles([{ packageName: 'pkg-1', comment, type: 'minor' }], options);
    repo.push();

    const { bumpInfo } = await bumpWrapper(parsedOptions);

    // Only pkg-1 actually gets bumped
    expect(bumpInfo?.calculatedChangeTypes).toEqual({ 'pkg-1': 'minor' });
    // Currently, pkg-2 ends up included due to https://github.com/microsoft/beachball/issues/1123
    expect(bumpInfo?.modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2']));
    expect(bumpInfo?.dependentChangedBy).toEqual({ 'pkg-2': new Set(['pkg-1']) });

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].dependencies!['pkg-2']).toBe(monorepo['packages']['pkg-2'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);

    const pkg1Changelog = readChangelogJson(repo.pathTo('packages/pkg-1'));
    expect(pkg1Changelog!.entries[0].comments.minor![0].comment).toBe(comment);
    // There's a check in writeChangeFiles to prevent writing changelogs for packages in
    // dependentChangedBy with no changeType
    const pkg2Changelog = readChangelogJson(repo.pathTo('packages/pkg-2'));
    expect(pkg2Changelog).toBeNull();
  });

  it('for multi-root monorepo, only bumps packages in the current root', async () => {
    repositoryFactory = new RepositoryFactory('multi-project');
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['project-a', 'project-b']);
    repo = repositoryFactory.cloneRepository();

    const projectARoot = repo.pathTo('project-a');
    const projectBRoot = repo.pathTo('project-b');
    const infoA = getOptions({ bumpDeps: true }, projectARoot);
    const optionsA = infoA.options;
    const infoB = getOptions({ bumpDeps: true }, projectBRoot);
    const optionsB = infoB.options;

    generateChangeFiles([{ packageName: '@project-a/foo' }], optionsA);
    generateChangeFiles([{ packageName: '@project-a/foo', type: 'major' }], optionsB);
    repo.push();

    await bumpWrapper(infoA.parsedOptions);

    const packageInfosA = getPackageInfos(infoA.parsedOptions.cliOptions);
    const packageInfosB = getPackageInfos(infoB.parsedOptions.cliOptions);
    expect(packageInfosA['@project-a/foo'].version).toBe('1.1.0');
    expect(packageInfosB['@project-b/foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(optionsA);
    const changeFilesB = getChangeFiles(optionsB);
    expect(changeFilesA).toHaveLength(0);
    expect(changeFilesB).toHaveLength(1);
  });

  // This is mostly covered by readChangeFiles and unlinkChangeFiles, but it might be good to
  // ensure it works all-up.
  it('bumps only packages with change files committed between specified ref and head using since/fromRef flag', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0' },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: false,
      // Incidentally use this to verify generateChangelog: false is respected
      generateChangelog: false,
    });
    // generate an initial set of change files
    generateChangeFiles(['pkg-1'], options);
    // set the initial change files commit as fromRef
    options.fromRef = repo.getCurrentHash();

    // generate a new set of change files
    generateChangeFiles(['pkg-3'], options);
    repo.push();

    const { bumpInfo, originalPackageInfos } = await bumpWrapper(parsedOptions);

    expect(bumpInfo.calculatedChangeTypes).toEqual({ 'pkg-3': 'minor' });
    expect(bumpInfo.modifiedPackages).toEqual(new Set(['pkg-3']));

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    expect(packageInfos['pkg-1']).toEqual(originalPackageInfos['pkg-1']);
    expect(packageInfos['pkg-2']).toEqual(originalPackageInfos['pkg-2']);
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);

    // Verify generateChangelog: false
    expect(readChangelogJson(repo.pathTo('packages/pkg-3'))).toBeNull();
    expect(readChangelogMd(repo.pathTo('packages/pkg-3'))).toBeNull();
  });

  it('bumps all dependent packages with bumpDeps: true (default)', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        // check all dependency types
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
        'pkg-5': { version: '1.0.0', optionalDependencies: { 'pkg-4': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      generateChangelog: true,
    });
    const comment = 'test comment for pkg-1';
    generateChangeFiles([{ packageName: 'pkg-1', type: 'minor', comment }], options);
    repo.push();

    const { bumpInfo } = await bumpWrapper(parsedOptions);

    expect(bumpInfo.modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2', 'pkg-3', 'pkg-4', 'pkg-5']));

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    const pkg1NewVersion = '1.1.0';
    const dependentNewVersion = '1.0.1';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(dependentNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(dependentNewVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(dependentNewVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(dependentNewVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(dependentNewVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);

    const pkg1Changelog = readChangelogJson(repo.pathTo('packages/pkg-1'));
    expect(pkg1Changelog!.entries[0].comments.minor![0].comment).toBe(comment);
    const pkg2Changelog = readChangelogJson(repo.pathTo('packages/pkg-2'));
    expect(pkg2Changelog!.entries[0].comments.patch![0].comment).toBe(`Bump pkg-1 to v${pkg1NewVersion}`);
    const pkg3Changelog = readChangelogJson(repo.pathTo('packages/pkg-3'));
    expect(pkg3Changelog!.entries[0].comments.patch![0].comment).toBe(`Bump pkg-2 to v${dependentNewVersion}`);
  });

  // Most grouped package scenarios are covered in bumpInMemory.test.ts.
  // Test this complicated scenario E2E too to verify all the pieces work together.
  it('bumps all grouped AND dependent packages', async () => {
    const monorepo: RepoFixture['folders'] = {
      'packages/grp': {
        // the test helper only handles one nesting level
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0' },
        'pkg-3': { version: '1.0.0', dependencies: { commonlib: '1.0.0' } },
      },
      packages: {
        app: { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        commonlib: { version: '1.0.0' },
        unrelated: { version: '1.0.0' },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      groups: [{ include: 'packages/grp/*', name: 'grp', disallowedChangeTypes: [] }],
      bumpDeps: true,
    });
    // Bump commonlib, which is not in the group, but triggers a dependent bump of pkg-3,
    // which triggers bump of the whole group and then the app.
    // Also verify the non-default dependentChangeType passes through.
    generateChangeFiles([{ packageName: 'commonlib', dependentChangeType: 'minor' }], options);
    repo.push();

    const { originalPackageInfos } = await bumpWrapper(parsedOptions);

    // This scenario is also covered in bumpInMemory, so focus on the filesystem parts
    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    const groupNewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-2'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(groupNewVersion);
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated']).toEqual(originalPackageInfos['unrelated']);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);

    // Current behavior: group bumps don't generate changelog entries
    // (not sure if this is good or bad)
    expect(readChangelogJson(repo.pathTo('packages/grp/pkg-1'))).toBeNull();
    expect(readChangelogJson(repo.pathTo('packages/grp/pkg-2'))).toBeNull();
    // The original dependent bump gets an entry
    const pkg3Changelog = readChangelogJson(repo.pathTo('packages/grp/pkg-3'));
    expect(pkg3Changelog!.entries[0].comments.minor![0].comment).toBe('Bump commonlib to v1.1.0');
    // As does bumping pkg-1 in app
    const appChangelog = readChangelogJson(repo.pathTo('packages/app'));
    expect(appChangelog!.entries[0].comments.minor![0].comment).toBe('Bump pkg-1 to v1.1.0');
  });

  // Scope filtering of changes happens in readChangesFiles, not the actual bump logic,
  // so we need an E2E test to make sure it all works together.
  // (Scope filtering of dependents happens in the bump step.)
  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      scope: ['!packages/bar'],
    });
    // bar depends on baz, so that gives bar an extra chance to get a dependent bump
    generateChangeFiles(['bar', 'baz'], options);
    repo.push();

    const { bumpInfo, originalPackageInfos } = await bumpWrapper(parsedOptions);

    // Verify the in-memory part of the bump
    expect(bumpInfo.calculatedChangeTypes).toEqual({ baz: 'minor' });
    expect(bumpInfo.modifiedPackages).toEqual(new Set(['baz']));
    expect(bumpInfo.dependentChangedBy).toEqual({});
    expect(bumpInfo.scopedPackages).toEqual(new Set(['baz', 'foo', 'a', 'b']));
    expect(bumpInfo.changeFileChangeInfos).toHaveLength(1);
    expect(bumpInfo.changeFileChangeInfos[0].change.packageName).toBe('baz');

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(packageInfos['bar']).toEqual(originalPackageInfos['bar']);
    expect(packageInfos['foo']).toEqual(originalPackageInfos['foo']);
    expect(packageInfos['baz'].version).toBe('1.4.0');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);

    expect(readChangelogJson(repo.pathTo('packages/bar'))).toBeNull();
    expect(readChangelogJson(repo.pathTo('packages/baz'))).not.toBeNull();
  });

  // Scope filtering of dependents currently happens in the bump step and can be tested in bumpInMemory,
  // but probably also good to have E2E coverage of this scenario in case that changes in the future.
  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      scope: ['!packages/foo'],
    });
    generateChangeFiles([{ packageName: 'bar', type: 'patch' }], options);
    repo.push();

    // bumpInMemory already tests the in-memory part of this scenario
    const { originalPackageInfos } = await bumpWrapper(parsedOptions);

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);
    expect(packageInfos['bar'].version).toBe('1.3.5');
    // Since foo is out of scope, currently its dep on bar is not bumped.
    // This is usually fine, but could be an issue if bar is bumped to an incompatible version.
    // Somewhat related: https://github.com/microsoft/beachball/issues/620#issuecomment-3609264966
    expect(packageInfos['foo']).toEqual(originalPackageInfos['foo']);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);

    expect(readChangelogJson(repo.pathTo('packages/bar'))).not.toBeNull();
    expect(readChangelogJson(repo.pathTo('packages/foo'))).toBeNull();
  });

  // This is mostly covered by bumpInMemory.test.ts, but the current changelog behavior is probably
  // worth documenting here.
  it('bumps dependents with file: deps', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '0.0.0', dependencies: { 'pkg-1': 'file:../pkg-1' } },
        'pkg-3': { version: '0.0.0', devDependencies: { 'pkg-2': 'file:../pkg-2' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      generateChangelog: true,
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'minor' }], options);

    repo.push();

    const { originalPackageInfos } = await bumpWrapper(parsedOptions);

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    // All the packages are bumped despite the file: dep specs.
    // The dep specs are not modified, but the dependent versions are bumped.
    expect(packageInfos['pkg-1']).toEqual({ ...originalPackageInfos['pkg-1'], version: '1.1.0' });
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '0.0.1' });
    expect(packageInfos['pkg-3']).toEqual({ ...originalPackageInfos['pkg-3'], version: '0.0.1' });

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);

    // Current behavior: dependentChangedBy misses file: deps, so pkg-2 and pkg-3 don't have
    // changelog entries for the pkg-1 bump.
    // https://github.com/microsoft/beachball/issues/981
    const changelogJson2 = readChangelogJson(repo.pathTo('packages/pkg-2'));
    expect(changelogJson2).toBeNull();
    const changelogJson3 = readChangelogJson(repo.pathTo('packages/pkg-3'));
    expect(changelogJson3).toBeNull();
  });

  // Prerelease scenarios are covered in more detail in bumpInMemory.test.ts
  it('bumps to prerelease and uses prerelease version for dependents', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
        'pkg-5': { version: '1.0.0', optionalDependencies: { 'pkg-4': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }], options);
    repo.push();

    await bumpWrapper(parsedOptions);

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    const newVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(newVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps dependents with workspace: deps', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        // Include some external deps to make sure nothing weird happens there
        'pkg-1': { version: '1.0.0', dependencies: { extra: '~1.2.3' } },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': 'workspace:~' } },
        // this workspace version will be updated
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': 'workspace:^1.0.0', other: 'npm:lodash' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'minor' }], options);
    repo.push();

    // The bumpInfo object is covered by the similar test in bumpInMemory.test.ts
    const { originalPackageInfos } = await bumpWrapper(parsedOptions);

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    // All the dependent packages are bumped despite the workspace: dep specs
    expect(packageInfos['pkg-1']).toEqual({ ...originalPackageInfos['pkg-1'], version: '1.1.0' });
    // workspace:~ range isn't changed
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '1.0.1' });
    // workspace: range with number is updated
    expect(packageInfos['pkg-3']).toEqual({
      ...originalPackageInfos['pkg-3'],
      version: '1.0.1',
      dependencies: { 'pkg-2': 'workspace:^1.0.1', other: 'npm:lodash' },
    });

    expect(readChangelogJson(repo.pathTo('packages/pkg-1'))).not.toBeNull();
    const pkg3Changelog = readChangelogJson(repo.pathTo('packages/pkg-3'));
    // this gets a changelog entry since the workspace:^1.0.0 dep was updated
    // (a little debatable whether the current text is correct)
    expect(pkg3Changelog!.entries[0].comments.patch![0].comment).toBe('Bump pkg-2 to v1.0.1');
    // Current behavior: dependentChangedBy misses deps like workspace:~ that don't change,
    // so the bump of pkg-1 will be missing from pkg-2's changelog.
    // https://github.com/microsoft/beachball/issues/981
    expect(readChangelogJson(repo.pathTo('packages/pkg-2'))).toBeNull();
  });

  it('bumps dependents with catalog: deps', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': 'catalog:' } },
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': 'catalog:' } },
      },
    };
    const catalogs: Catalogs = {
      default: { 'pkg-1': 'workspace:~', 'pkg-2': 'workspace:^1.0.0' },
    };
    repositoryFactory = new RepositoryFactory({
      folders: monorepo,
      // This isn't currently read by bump() but should be present for completeness
      extraFiles: { '.yarnrc.yml': catalogsToYaml(catalogs) },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'minor' }], options);
    repo.push();

    // The bumpInfo object is covered by the similar test in bumpInMemory.test.ts
    const { originalPackageInfos } = await bumpWrapper(parsedOptions);

    const packageInfos = getPackageInfos(parsedOptions.cliOptions);

    // All the dependent packages are bumped despite the catalog: dep specs
    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    // catalog: ranges aren't changed
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '1.0.1' });
    expect(packageInfos['pkg-3']).toEqual({ ...originalPackageInfos['pkg-3'], version: '1.0.1' });

    expect(readChangelogJson(repo.pathTo('packages/pkg-1'))).not.toBeNull();
    // Current behavior: dependentChangedBy misses catalog: deps, so there are no changelog entries
    // https://github.com/microsoft/beachball/issues/981
    expect(readChangelogJson(repo.pathTo('packages/pkg-2'))).toBeNull();
    expect(readChangelogJson(repo.pathTo('packages/pkg-3'))).toBeNull();
  });

  // Explicit tests for sync/async hooks aren't necessary, especially since these are slow tests.
  // Async is slightly trickier, so test that.
  it('calls prebump/postbump hooks', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: false,
      hooks: {
        prebump: jest.fn<NonNullable<HooksOptions['prebump']>>(async (packagePath, name, version) => {
          expect(packagePath.endsWith('pkg-1')).toBeTruthy();
          expect(name).toBe('pkg-1');
          // This is currently wrong--it should still be the old version
          // https://github.com/microsoft/beachball/issues/1116
          expect(version).toBe('1.1.0');

          await new Promise(resolve => setTimeout(resolve, 0)); // simulate async work
          const jsonPath = path.join(packagePath, 'package.json');
          expect(readJson<PackageJson>(jsonPath).version).toBe('1.0.0');
        }),
        postbump: jest.fn<NonNullable<HooksOptions['postbump']>>(async (packagePath, name, version) => {
          expect(packagePath.endsWith('pkg-1')).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          await new Promise(resolve => setTimeout(resolve, 0)); // simulate async work
          const jsonPath = path.join(packagePath, 'package.json');
          expect(readJson<PackageJson>(jsonPath).version).toBe('1.1.0');
        }),
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    // Skip validate for this test
    await bump(options, createCommandContext(parsedOptions));

    expect(options.hooks?.prebump).toHaveBeenCalled();
    expect(options.hooks?.postbump).toHaveBeenCalled();
  });
});
