import { describe, expect, it, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import path from 'path';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { readChangelogJson } from '../__fixtures__/changelog';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { RepoFixture, RepositoryFactory } from '../__fixtures__/repositoryFactory';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  initMockLogs();

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('bumps only packages with change files', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({ path: repo.rootPath, bumpDeps: false } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe(monorepo['packages']['pkg-3'].version);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(monorepo['packages']['pkg-3'].version);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('for multi-workspace (multi-monorepo), only bumps packages in the current workspace', async () => {
    repositoryFactory = new RepositoryFactory('multi-workspace');
    expect(Object.keys(repositoryFactory.fixtures)).toEqual(['workspace-a', 'workspace-b']);
    const repo = repositoryFactory.cloneRepository();

    const workspaceARoot = repo.pathTo('workspace-a');
    const workspaceBRoot = repo.pathTo('workspace-b');

    generateChangeFiles([{ packageName: '@workspace-a/foo' }], workspaceARoot);
    generateChangeFiles([{ packageName: '@workspace-a/foo', type: 'major' }], workspaceBRoot);

    repo.push();

    await bump({ path: workspaceARoot, bumpDeps: true } as BeachballOptions);

    const packageInfosA = getPackageInfos(workspaceARoot);
    const packageInfosB = getPackageInfos(workspaceBRoot);
    expect(packageInfosA['@workspace-a/foo'].version).toBe('1.1.0');
    expect(packageInfosB['@workspace-b/foo'].version).toBe('1.0.0');

    const changeFilesA = getChangeFiles(workspaceARoot);
    const changeFilesB = getChangeFiles(workspaceBRoot);
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
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    const oldCommit = repo.getCurrentHash();

    generateChangeFiles(['pkg-3'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      fromRef: oldCommit,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe(monorepo['packages']['pkg-1'].version);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(monorepo['packages']['pkg-1'].version);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('bumps all dependent packages with `bumpDeps` flag', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({ path: repo.rootPath, bumpDeps: true } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const pkg1NewVersion = '1.1.0';
    const dependentNewVersion = '1.0.1';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(dependentNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(dependentNewVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(dependentNewVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(dependentNewVersion);

    const changeFiles = getChangeFiles(repo.rootPath);
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
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      groups: [{ include: 'packages/*', name: 'testgroup' }],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const newVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['pkg-4'].version).toBe(monorepo['unrelated']['pkg-4'].version);

    const changeFiles = getChangeFiles(repo.rootPath);
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
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles([{ packageName: 'commonlib', dependentChangeType: 'minor' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      groups: [{ include: 'packages/grp/*', name: 'grp' }],
      bumpDeps: true,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const groupNewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-2'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(groupNewVersion);
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated'].version).toBe(monorepo['packages'].unrelated.version);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const monorepo = repositoryFactory.fixture.folders!;
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      scope: ['!packages/foo'],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe(monorepo['packages']['foo'].version);
    expect(packageInfos['bar'].version).toBe(monorepo['packages']['bar'].version);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', async () => {
    repositoryFactory = new RepositoryFactory('monorepo');
    const monorepo = repositoryFactory.fixture.folders!;
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles([{ packageName: 'bar', type: 'patch' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      scope: ['!packages/foo'],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe(monorepo['packages']['foo'].version);
    expect(packageInfos['bar'].version).toBe('1.3.5');
    expect(packageInfos['foo'].dependencies!['bar']).toBe(monorepo['packages']['foo'].dependencies!['bar']);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and keeps change files with `keep-change-files` flag', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      keepChangeFiles: true,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-3'].version).toBe(monorepo['packages']['pkg-3'].version);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(monorepo['packages']['pkg-2'].version);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(monorepo['packages']['pkg-3'].version);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('bumps all packages and uses prefix in the version with default identifier base', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const newVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and uses prefix in the version with the right identifier base', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
      identifierBase: "1"
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const newVersion = '1.0.1-beta.1';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and uses prefix in the version with no identifier base', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
      identifierBase: false
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const newVersion = '1.0.1-beta';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and uses prefixed versions in dependents', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(
      [{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }],
      repo.rootPath
    );

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const newVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(newVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(newVersion);

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and increments prefixed versions in dependents', async () => {
    const monorepo: RepoFixture['folders'] = {
      packages: {
        'pkg-1': { version: '1.0.1-beta.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
      },
    };
    repositoryFactory = new RepositoryFactory({ folders: monorepo });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(
      [{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }],
      repo.rootPath
    );

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    const pkg1NewVersion = '1.0.1-beta.1';
    const othersNewVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(othersNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(othersNewVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(othersNewVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(othersNewVersion);

    const changeFiles = getChangeFiles(repo.rootPath);
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
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(
      [
        {
          type: 'patch',
          comment: 'This package1 test comment should be absorbed into the changelog.',
          packageName: 'package1',
        },
      ],
      repo.rootPath
    );

    repo.push();

    const bumpInfo = await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      generateChangelog: true,
    } as BeachballOptions);

    const modified = [...bumpInfo.modifiedPackages];
    expect(modified).toContain('package1');
    expect(modified).toContain('package2');

    const changelogJson = readChangelogJson(repo.pathTo('packages/package2'));
    expect(changelogJson.entries[0].comments.patch![0].comment).toBe('Bump package1 to v0.0.2');
  });

  it('calls sync prebump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    let prebumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        prebump: (packagePath, name, version) => {
          prebumpCalled = true;
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect(fs.readJSONSync(jsonPath).version).toBe('1.0.0');
        },
      },
    } as BeachballOptions);

    expect(prebumpCalled).toBe(true);
  });

  it('calls async prebump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    let prebumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        prebump: async (packagePath, name, version) => {
          prebumpCalled = true;
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect((await fs.readJSON(jsonPath)).version).toBe('1.0.0');
        },
      },
    } as BeachballOptions);

    expect(prebumpCalled).toBe(true);
  });

  it('propagates prebump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    const bumpResult = bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        prebump: async (_packagePath, _name, _version): Promise<void> => {
          throw new Error('Foo');
        },
      },
    } as BeachballOptions);

    await expect(bumpResult).rejects.toThrow('Foo');
  });

  it('calls sync postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    let postBumpCalled = false;

    const hooks: BeachballOptions['hooks'] = {
      postbump: (packagePath, name, version) => {
        postBumpCalled = true;
        expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
        expect(name).toBe('pkg-1');
        expect(version).toBe('1.1.0');

        const jsonPath = path.join(packagePath, 'package.json');
        expect(fs.readJSONSync(jsonPath).version).toBe('1.1.0');
      },
    };

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks,
    } as BeachballOptions);

    expect(postBumpCalled).toBe(true);
  });

  it('calls async postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    let postbumpCalled = false;

    const hooks: BeachballOptions['hooks'] = {
      postbump: async (packagePath, name, version) => {
        postbumpCalled = true;
        expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
        expect(name).toBe('pkg-1');
        expect(version).toBe('1.1.0');

        const jsonPath = path.join(packagePath, 'package.json');
        expect((await fs.readJSON(jsonPath)).version).toBe('1.1.0');
      },
    };

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks,
    } as BeachballOptions);

    expect(postbumpCalled).toBe(true);
  });

  it('propagates postbump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory({
      folders: {
        packages: { 'pkg-1': { version: '1.0.0' } },
      },
    });
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    const hooks: BeachballOptions['hooks'] = {
      postbump: async (_packagePath, _name, _version): Promise<void> => {
        throw new Error('Foo');
      },
    };

    const bumpResult = bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks,
    } as BeachballOptions);

    await expect(bumpResult).rejects.toThrow('Foo');
  });
});
