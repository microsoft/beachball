import { describe, expect, it, afterEach, jest } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { readChangelogJson } from '../__fixtures__/changelog';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { type RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import type { BeachballOptions, HooksOptions } from '../types/BeachballOptions';
import type { Repository } from '../__fixtures__/repository';
import { getDefaultOptions } from '../options/getDefaultOptions';
import type { PackageJson } from '../types/PackageInfo';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;
  let repo: Repository | undefined;

  initMockLogs();

  function getOptions(options?: Partial<BeachballOptions>): BeachballOptions {
    return {
      ...getDefaultOptions(),
      path: repo?.rootPath || '',
      ...options,
    };
  }

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
    repo = undefined;
  });

  it('bumps only packages with change files', async () => {
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

    const options = getOptions({
      bumpDeps: false,
    });
    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe(monorepo['packages']['pkg-3'].version);
    expect(packageInfos['pkg-4'].version).toBe(monorepo['packages']['pkg-4'].version);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(monorepo['packages']['pkg-3'].version);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(monorepo['packages']['pkg-4'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  it('correctly bumps packages with change files when changeDir is set', async () => {
    const testChangedir = 'changeDir';

    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: false,
      changeDir: testChangedir,
    });
    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  it('for multi-workspace (multi-monorepo), only bumps packages in the current workspace', async () => {
    repositoryFactory = new RepositoryFactory('multi-workspace');
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['workspace-a', 'workspace-b']);
    repo = repositoryFactory.cloneRepository();

    const workspaceARoot = repo.pathTo('workspace-a');
    const workspaceBRoot = repo.pathTo('workspace-b');
    const optionsA = getOptions({ path: workspaceARoot, bumpDeps: true });
    const optionsB = getOptions({ path: workspaceBRoot, bumpDeps: true });

    generateChangeFiles([{ packageName: '@workspace-a/foo' }], optionsA);
    generateChangeFiles([{ packageName: '@workspace-a/foo', type: 'major' }], optionsB);
    repo.push();

    await bump(optionsA);

    const packageInfosA = getPackageInfos(workspaceARoot);
    const packageInfosB = getPackageInfos(workspaceBRoot);
    expect(packageInfosA['@workspace-a/foo'].version).toBe('1.1.0');
    expect(packageInfosB['@workspace-b/foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(optionsA);
    const changeFilesB = getChangeFiles(optionsB);
    expect(changeFilesA).toHaveLength(0);
    expect(changeFilesB).toHaveLength(1);
  });

  it('bumps only packages with change files committed between specified ref and head using `since` flag', async () => {
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
    const options = getOptions({ bumpDeps: false });
    generateChangeFiles(['pkg-1'], options);
    // set the initial change files commit as fromRef
    options.fromRef = repo.getCurrentHash();

    // generate a new set of change files
    generateChangeFiles(['pkg-3'], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe(monorepo['packages']['pkg-1'].version);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(monorepo['packages']['pkg-1'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  it('bumps all dependent packages with `bumpDeps` flag', async () => {
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

    const options = getOptions({ bumpDeps: true });
    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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
  });

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

    const options = getOptions({
      groups: [{ include: 'packages/*', name: 'testgroup', disallowedChangeTypes: [] }],
    });
    generateChangeFiles(['pkg-1'], options);

    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

    const newVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(monorepo['unrelated']['pkg-4'].version);

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

    const options = getOptions({
      groups: [{ include: 'packages/grp/*', name: 'grp', disallowedChangeTypes: [] }],
      bumpDeps: true,
    });
    generateChangeFiles([{ packageName: 'commonlib', dependentChangeType: 'minor' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

    const groupNewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-2'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(groupNewVersion);
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated'].version).toBe(monorepo['packages'].unrelated.version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const monorepo = repositoryFactory.fixture.folders;
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: true,
      scope: ['!packages/foo'],
    });
    generateChangeFiles(['foo'], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe(monorepo['packages']['foo'].version);
    expect(packageInfos['bar'].version).toBe(monorepo['packages']['bar'].version);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(1);
  });

  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const monorepo = repositoryFactory.fixture.folders;
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: true,
      scope: ['!packages/foo'],
    });
    generateChangeFiles([{ packageName: 'bar', type: 'patch' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe(monorepo['packages']['foo'].version);
    expect(packageInfos['bar'].version).toBe('1.3.5');
    expect(packageInfos['foo'].dependencies!['bar']).toBe(monorepo['packages']['foo'].dependencies!['bar']);

    const changeFiles = getChangeFiles(options);
    expect(changeFiles).toHaveLength(0);
  });

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

    const options = getOptions({
      bumpDeps: false,
      keepChangeFiles: true,
    });
    generateChangeFiles(['pkg-1'], options);

    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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

    const options = getOptions({
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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

    const options = getOptions({
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
      identifierBase: '1',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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

    const options = getOptions({
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
      identifierBase: false,
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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

  it('bumps all packages and uses prefixed versions in dependents', async () => {
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

    const options = getOptions({
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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

    const options = getOptions({
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    });
    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }], options);
    repo.push();

    await bump(options);

    const packageInfos = getPackageInfos(repo.rootPath);

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

  it('generates correct changelogs and modified packages when bumpDeps is true', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        package1: { version: '0.0.1' },
        package2: { version: '0.0.1', dependencies: { package1: '^0.0.1' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: true,
      keepChangeFiles: false,
      generateChangelog: true,
    });
    generateChangeFiles(
      [
        {
          type: 'patch',
          comment: 'This package1 test comment should be absorbed into the changelog.',
          packageName: 'package1',
        },
      ],
      options
    );

    repo.push();

    const bumpInfo = await bump(options);

    const modified = [...bumpInfo.modifiedPackages];
    expect(modified).toContain('package1');
    expect(modified).toContain('package2');

    const changelogJson = readChangelogJson(repo.pathTo('packages/package2'));
    expect(changelogJson?.entries[0].comments.patch![0].comment).toBe('Bump package1 to v0.0.2');
  });

  it('calls sync prebump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: false,
      hooks: {
        prebump: jest.fn<Required<HooksOptions>['prebump']>((packagePath, name, version) => {
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect((fs.readJSONSync(jsonPath) as PackageJson).version).toBe('1.0.0');
        }),
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    expect(options.hooks?.prebump).toHaveBeenCalled();
  });

  it('calls async prebump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: false,
      hooks: {
        prebump: jest.fn<Required<HooksOptions>['prebump']>(async (packagePath, name, version) => {
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect(((await fs.readJSON(jsonPath)) as PackageJson).version).toBe('1.0.0');
        }),
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    expect(options.hooks?.prebump).toHaveBeenCalled();
  });

  it('propagates prebump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
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

    const bumpResult = bump(options);

    await expect(bumpResult).rejects.toThrow('Foo');
  });

  it('calls sync postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: false,
      hooks: {
        postbump: jest.fn<Required<HooksOptions>['postbump']>((packagePath, name, version) => {
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect((fs.readJSONSync(jsonPath) as PackageJson).version).toBe('1.1.0');
        }),
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    expect(options.hooks?.postbump).toHaveBeenCalled();
  });

  it('calls async postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: false,
      hooks: {
        postbump: jest.fn<Required<HooksOptions>['postbump']>(async (packagePath, name, version) => {
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect(((await fs.readJSON(jsonPath)) as PackageJson).version).toBe('1.1.0');
        }),
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    await bump(options);

    expect(options.hooks?.postbump).toHaveBeenCalled();
  });

  it('propagates postbump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    repo = repositoryFactory.cloneRepository();

    const options = getOptions({
      bumpDeps: false,
      hooks: {
        postbump: (): Promise<void> => {
          throw new Error('Foo');
        },
      },
    });

    generateChangeFiles(['pkg-1'], options);
    repo.push();

    const bumpResult = bump(options);

    await expect(bumpResult).rejects.toThrow('Foo');
  });
});
