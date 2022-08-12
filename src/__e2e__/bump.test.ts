import fs from 'fs-extra';
import path from 'path';
import { generateChangeFiles, getChangeFiles } from '../__fixtures__/changeFiles';
import { readChangelogJson } from '../__fixtures__/changelog';
import { initMockLogs } from '../__fixtures__/mockLogs';
import { MonoRepoFactory } from '../__fixtures__/monorepo';
import { RepositoryFactory } from '../__fixtures__/repository';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | MonoRepoFactory | undefined;

  initMockLogs();

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('bumps only packages with change files', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({ path: repo.rootPath, bumpDeps: false } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps only packages with change files committed between specified ref and head using `since` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

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

    expect(packageInfos['pkg-1'].version).toBe('1.0.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('bumps all dependent packages with `bumpDeps` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({ path: repo.rootPath, bumpDeps: true } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all grouped packages', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'unrelated/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      groups: [{ include: 'packages/*', name: 'testgroup' }],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.1.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-4'].version).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all grouped AND dependent packages', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/grp/1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/grp/2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/grp/3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        dependencies: {
          commonlib: '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/commonlib/package.json',
      JSON.stringify({
        name: 'commonlib',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/app/package.json',
      JSON.stringify({
        name: 'app',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/unrelated/package.json',
      JSON.stringify({
        name: 'unrelated',
        version: '1.0.0',
      })
    );

    generateChangeFiles([{ packageName: 'commonlib', dependentChangeType: 'minor' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      groups: [{ include: 'packages/grp/*', name: 'grp' }],
      bumpDeps: true,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.1.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated'].version).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new MonoRepoFactory();
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles(['foo'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      scope: ['!packages/foo'],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe('1.0.0');
    expect(packageInfos['bar'].version).toBe('1.3.4');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', async () => {
    repositoryFactory = new MonoRepoFactory();
    const repo = repositoryFactory.cloneRepository();

    generateChangeFiles([{ packageName: 'bar', type: 'patch' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      scope: ['!packages/foo'],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe('1.0.0');
    expect(packageInfos['bar'].version).toBe('1.3.5');
    expect(packageInfos['foo'].dependencies?.bar).toBe('^1.3.4');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and keeps change files with `keep-change-files` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      keepChangeFiles: true,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(1);
  });

  it('bumps all packages and uses prefix in the version', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

    generateChangeFiles([{ packageName: 'pkg-1', type: 'prerelease' }], repo.rootPath);

    repo.push();

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1-beta.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1-beta.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and uses prefixed versions in dependents', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

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

    expect(packageInfos['pkg-1'].version).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1-beta.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1-beta.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('bumps all packages and increments prefixed versions in dependents', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.1-beta.0',
      })
    );

    repo.commitChange(
      'packages/pkg-2/package.json',
      JSON.stringify({
        name: 'pkg-2',
        version: '1.0.0',
        dependencies: {
          'pkg-1': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-3/package.json',
      JSON.stringify({
        name: 'pkg-3',
        version: '1.0.0',
        devDependencies: {
          'pkg-2': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'packages/pkg-4/package.json',
      JSON.stringify({
        name: 'pkg-4',
        version: '1.0.0',
        peerDependencies: {
          'pkg-3': '1.0.0',
        },
      })
    );

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'foo-repo',
        version: '1.0.0',
        private: true,
      })
    );

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

    expect(packageInfos['pkg-1'].version).toBe('1.0.1-beta.1');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1-beta.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.1-beta.1');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1-beta.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles).toHaveLength(0);
  });

  it('generates correct changelogs and modified packages when bumpDeps is true', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'beachball-comments-repro',
        version: '1.0.0',
        workspaces: {
          packages: ['packages/*'],
        },
        private: true,
      })
    );

    repo.commitChange(
      'packages/package1/package.json',
      JSON.stringify({
        name: 'package1',
        version: '0.0.1',
      })
    );
    repo.commitChange(
      'packages/package2/package.json',
      JSON.stringify({
        name: 'package2',
        version: '0.0.1',
        dependencies: {
          package1: '^0.0.1',
        },
      })
    );

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
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

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
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

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
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

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

    expect(bumpResult).rejects.toThrow();
  });

  it('calls sync postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    let postBumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        postbump: (packagePath, name, version) => {
          postBumpCalled = true;
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect(fs.readJSONSync(jsonPath).version).toBe('1.1.0');
        },
      },
    } as BeachballOptions);

    expect(postBumpCalled).toBe(true);
  });

  it('calls async postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    let postbumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        postbump: async (packagePath, name, version) => {
          postbumpCalled = true;
          expect(packagePath.endsWith(path.join('packages', 'pkg-1'))).toBeTruthy();
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect((await fs.readJSON(jsonPath)).version).toBe('1.1.0');
        },
      },
    } as BeachballOptions);

    expect(postbumpCalled).toBe(true);
  });

  it('propagates postbump hook exceptions', async () => {
    repositoryFactory = new RepositoryFactory();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    generateChangeFiles(['pkg-1'], repo.rootPath);

    repo.push();

    const bumpResult = bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        postbump: async (_packagePath, _name, _version): Promise<void> => {
          throw new Error('Foo');
        },
      },
    } as BeachballOptions);

    expect(bumpResult).rejects.toThrow();
  });
});
