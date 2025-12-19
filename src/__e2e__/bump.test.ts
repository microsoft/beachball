import { describe, expect, it, afterEach, jest } from '@jest/globals';
import path from 'path';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { readChangelogJson } from '../__fixtures__/changelog';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { HooksOptions, RepoOptions } from '../types/BeachballOptions';
import type { Repository } from '../__fixtures__/repository';
import type { PackageJson } from '../types/PackageInfo';
import { getParsedOptions } from '../options/getOptions';
import { defaultRemoteBranchName } from '../__fixtures__/gitDefaults';
import { readJson } from '../object/readJson';
import { validate } from '../validation/validate';
import { createCommandContext } from '../monorepo/createCommandContext';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  initMockLogs();

  function getOptions(repoOptions?: Partial<RepoOptions>, cwd?: string) {
    const parsedOptions = getParsedOptions({
      cwd: cwd || repo?.rootPath || '',
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName, ...repoOptions },
    });
    return { options: parsedOptions.options, parsedOptions };
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
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
        'pkg-5': { version: '1.0.0', optionalDependencies: { 'pkg-4': '1.0.0' } },
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

    // For this test, use validate() similar to the CLI to ensure it works
    const { context } = validate(parsedOptions, { checkDependencies: true });
    const { bumpInfo } = context;

    // Only pkg-1 actually gets bumped
    expect(bumpInfo?.calculatedChangeTypes).toEqual({ 'pkg-1': 'minor' });
    // Currently, pkg-2 ends up included due to https://github.com/microsoft/beachball/issues/1123
    expect(bumpInfo?.modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2']));
    expect(bumpInfo?.dependentChangedBy).toEqual({ 'pkg-2': new Set(['pkg-1']) });

    await bump(options, context);

    const packageInfos = getPackageInfos(parsedOptions);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');
    expect(packageInfos['pkg-4'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(monorepo['packages']['pkg-3'].version);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(monorepo['packages']['pkg-4'].version);

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
    repositoryFactory = new RepositoryFactory('multi-workspace');
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['workspace-a', 'workspace-b']);
    repo = repositoryFactory.cloneRepository();

    const workspaceARoot = repo.pathTo('workspace-a');
    const workspaceBRoot = repo.pathTo('workspace-b');
    const infoA = getOptions({ bumpDeps: true }, workspaceARoot);
    const optionsA = infoA.options;
    const infoB = getOptions({ bumpDeps: true }, workspaceBRoot);
    const optionsB = infoB.options;

    generateChangeFiles([{ packageName: '@workspace-a/foo' }], optionsA);
    generateChangeFiles([{ packageName: '@workspace-a/foo', type: 'major' }], optionsB);
    repo.push();

    await bump(optionsA, createCommandContext(infoA.parsedOptions));

    const packageInfosA = getPackageInfos(infoA.parsedOptions);
    const packageInfosB = getPackageInfos(infoB.parsedOptions);
    expect(packageInfosA['@workspace-a/foo'].version).toBe('1.1.0');
    expect(packageInfosB['@workspace-b/foo'].version).toBe('1.0.0');

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

    // generate an initial set of change files
    const { options, parsedOptions } = getOptions({
      bumpDeps: false,
    });
    generateChangeFiles(['pkg-1'], options);
    // set the initial change files commit as fromRef
    options.fromRef = repo.getCurrentHash();

    // generate a new set of change files
    generateChangeFiles(['pkg-3'], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    expect(packageInfos['pkg-1'].version).toBe(monorepo['packages']['pkg-1'].version);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(monorepo['packages']['pkg-1'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  it('bumps all dependent packages with bumpDeps: true (default)', async () => {
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
      generateChangelog: true,
    });
    const comment = 'test comment for pkg-1';
    generateChangeFiles([{ packageName: 'pkg-1', type: 'minor', comment }], options);
    repo.push();

    // For this test, use validate() similar to the CLI to ensure it works
    const { context } = validate(parsedOptions, { checkDependencies: true });
    const { bumpInfo } = context;
    expect(bumpInfo?.modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2', 'pkg-3', 'pkg-4', 'pkg-5']));

    await bump(options, context);

    const packageInfos = getPackageInfos(parsedOptions);

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

  // TODO: move to bumpInMemory tests
  it('bumps all grouped packages', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0' },
        'pkg-3': { version: '1.0.0' },
      },
      unrelated: {
        'pkg-4': { version: '1.0.0' },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      groups: [{ include: 'packages/*', name: 'testgroup', disallowedChangeTypes: [] }],
    });
    generateChangeFiles(['pkg-1'], options);

    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const newVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(monorepo['unrelated']['pkg-4'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  // TODO: move to bumpInMemory tests
  it('bumps all grouped packages to the greatest change type in the group, regardless of change file order', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    repo = repositoryFactory.cloneRepository();

    repo.commitChange('packages/commonlib/package.json', {
      // The prefix z- here ensures commonlib's change file is loaded AFTER its dependents.
      // This makes sure we set the group's version bumps based on ChangeType order and not in
      // the sort order the filesystem gives us.
      name: 'z-commonlib',
      version: '1.0.0',
    });
    repo.commitChange('packages/pkg-1/package.json', {
      name: 'pkg-1',
      version: '1.0.0',
      dependencies: {
        'z-commonlib': '1.0.0',
      },
    });

    const { options, parsedOptions } = getOptions({
      groups: [{ include: 'packages/*', disallowedChangeTypes: null, name: 'grp' }],
      bumpDeps: true,
      commit: true,
    });
    generateChangeFiles(
      [
        { packageName: 'z-commonlib', type: 'none', dependentChangeType: 'none' },
        { packageName: 'pkg-1', type: 'minor', dependentChangeType: 'minor' },
      ],
      options
    );
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['z-commonlib'].version).toBe('1.1.0');

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

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
    generateChangeFiles([{ packageName: 'commonlib', dependentChangeType: 'minor' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const groupNewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-2'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(groupNewVersion);
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated'].version).toBe(monorepo['packages'].unrelated.version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);

    // TODO check changelogs
  });

  // Scope filtering of changes happens in readChangesFiles, not the actual bump logic,
  // so we need an E2E test to make sure it all works together.
  // (Scope filtering of dependents happens in the bump step.)
  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const monorepo = repositoryFactory.fixture.folders;
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      scope: ['!packages/bar'],
    });
    generateChangeFiles(['bar'], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);
    expect(packageInfos['bar'].version).toBe(monorepo['packages']['bar'].version);
    expect(packageInfos['foo'].version).toBe(monorepo['packages']['foo'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  // Scope filtering of dependents currently happens in the bump step and can be tested in bumpInMemory,
  // but probably also good to have E2E coverage of this scenario in case that changes in the future.
  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const monorepo = repositoryFactory.fixture.folders;
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: true,
      scope: ['!packages/foo'],
    });
    generateChangeFiles([{ packageName: 'bar', type: 'patch' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);
    expect(packageInfos['foo'].version).toBe(monorepo['packages']['foo'].version);
    expect(packageInfos['bar'].version).toBe('1.3.5');
    // Since foo is out of scope, currently its dep on bar is not bumped.
    // This is usually fine, but could be an issue if bar is bumped to an incompatible version.
    // Somewhat related: https://github.com/microsoft/beachball/issues/620#issuecomment-3609264966
    expect(packageInfos['foo'].dependencies!['bar']).toBe(monorepo['packages']['foo'].dependencies!['bar']);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
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

    const context = createCommandContext(parsedOptions);
    const { originalPackageInfos } = context;
    await bump(options, context);

    const packageInfos = getPackageInfos(parsedOptions);

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

  // TODO: move to bumpInMemory tests
  it('bumps all packages and keeps change files with `keep-change-files` flag', async () => {
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
      bumpDeps: false,
      keepChangeFiles: true,
    });
    generateChangeFiles(['pkg-1'], options);

    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe(monorepo['packages']['pkg-3'].version);
    expect(packageInfos['pkg-4'].version).toBe(monorepo['packages']['pkg-4'].version);
    expect(packageInfos['pkg-5'].version).toBe(monorepo['packages']['pkg-5'].version);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(monorepo['packages']['pkg-3'].version);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(monorepo['packages']['pkg-4'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  // TODO: move to bumpInMemory tests
  it('bumps all packages and uses prefix in the version with default identifier base', async () => {
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
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const newVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(newVersion);
    expect(packageInfos['pkg-5'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(newVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  // TODO: move to bumpInMemory tests
  it('bumps all packages and uses prefix in the version with the right identifier base', async () => {
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
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
      identifierBase: '1',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const newVersion = '1.0.1-beta.1';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(newVersion);
    expect(packageInfos['pkg-5'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(newVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  // TODO: move to bumpInMemory tests
  it('bumps all packages and uses prefix in the version with no identifier base', async () => {
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
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
      identifierBase: false,
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const newVersion = '1.0.1-beta';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(newVersion);
    expect(packageInfos['pkg-5'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(newVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

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
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

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

  // TODO: move to bumpInMemory tests
  it('bumps all packages and increments prefixed versions in dependents', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.1-beta.0' },
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
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }], options);
    repo.push();

    await bump(options, createCommandContext(parsedOptions));

    const packageInfos = getPackageInfos(parsedOptions);

    const pkg1NewVersion = '1.0.1-beta.1';
    const othersNewVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(othersNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(othersNewVersion);
    expect(packageInfos['pkg-4'].version).toBe(othersNewVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(othersNewVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(othersNewVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(othersNewVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  // TODO test workspace versions

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

    await bump(options, createCommandContext(parsedOptions));

    expect(options.hooks?.prebump).toHaveBeenCalled();
    expect(options.hooks?.postbump).toHaveBeenCalled();
  });

  // TODO: move to performBump test (no repo)
  it('propagates prebump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        prebump: (): Promise<void> => {
          throw new Error('Foo');
        },
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await expect(() => bump(options, createCommandContext(parsedOptions))).rejects.toThrow('Foo');
  });

  // TODO: move to performBump test (no repo)
  it('propagates postbump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const { options, parsedOptions } = getOptions({
      bumpDeps: false,
      hooks: {
        postbump: (): Promise<void> => {
          throw new Error('Foo');
        },
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await expect(() => bump(options, createCommandContext(parsedOptions))).rejects.toThrow('Foo');
  });
});
