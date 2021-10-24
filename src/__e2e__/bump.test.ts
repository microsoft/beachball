import fs from 'fs-extra';
import { RepositoryFactory } from '../fixtures/repository';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { git } from 'workspace-tools';
import { bump } from '../commands/bump';
import { getPackageInfos } from '../monorepo/getPackageInfos';
import { BeachballOptions } from '../types/BeachballOptions';
import { getChangePath } from '../paths';
import { MonoRepoFactory } from '../fixtures/monorepo';
import path from 'path';

describe('version bumping', () => {
  let repositoryFactory: RepositoryFactory | undefined;

  function getChangeFiles(cwd: string): string[] {
    const changePath = getChangePath(cwd);
    const changeFiles = changePath && fs.existsSync(changePath) ? fs.readdirSync(changePath) : [];
    return changeFiles;
  }

  afterEach(() => {
    if (repositoryFactory) {
      repositoryFactory.cleanUp();
      repositoryFactory = undefined;
    }
  });

  it('bumps only packages with change files', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: false } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps only packages with change files committed between specified ref and head using `since` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    const revParseOutput = git(['rev-parse', 'HEAD'], { cwd: repo.rootPath });
    if (!revParseOutput.success) {
      fail('failed to retrieve the HEAD SHA');
    }

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-3',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      fromRef: revParseOutput.stdout,
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.0.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });

  it('bumps all dependent packages with `bumpDeps` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: true } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all grouped packages', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

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
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all grouped AND dependent packages', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'commonlib',
          dependentChangeType: 'minor',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

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
    expect(changeFiles.length).toBe(0);
  });

  it('should not bump out-of-scope package even if package has change', async () => {
    repositoryFactory = new MonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'foo',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      scope: ['!packages/foo'],
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);
    expect(packageInfos['foo'].version).toBe('1.0.0');
    expect(packageInfos['bar'].version).toBe('1.3.4');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });

  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', async () => {
    repositoryFactory = new MonoRepoFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    writeChangeFiles({
      changes: [
        {
          type: 'patch',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'bar',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

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
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all packages and keeps change files with `keep-change-files` flag', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({ path: repo.rootPath, bumpDeps: false, keepChangeFiles: true } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.0');
    expect(packageInfos['pkg-3'].version).toBe('1.0.0');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.1.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.0');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.0');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(1);
  });

  it('bumps all packages and uses prefix in the version', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'prerelease',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      prereleasePrefix: 'beta',
    } as BeachballOptions);

    const packageInfos = getPackageInfos(repo.rootPath);

    expect(packageInfos['pkg-1'].version).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-2'].version).toBe('1.0.1');
    expect(packageInfos['pkg-3'].version).toBe('1.0.1');

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe('1.0.1-beta.0');
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe('1.0.1');
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe('1.0.1');

    const changeFiles = getChangeFiles(repo.rootPath);
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all packages and uses prefixed versions in dependents', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'prerelease',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'prerelease',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

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
    expect(changeFiles.length).toBe(0);
  });

  it('bumps all packages and increments prefixed versions in dependents', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
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

    writeChangeFiles({
      changes: [
        {
          type: 'prerelease',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'prerelease',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

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
    expect(changeFiles.length).toBe(0);
  });

  it('will generate correct dependent changelogs (bumps by dependent change), in monorepo', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'beachball-comments-repro',
        version: '1.0.0',
        license: 'UNLICENSED',
        workspaces: {
          packages: ['packages/*'],
        },
        private: true,
        repository: {
          type: 'git',
        },
      })
    );

    repo.commitChange(
      'packages/package1/package.json',
      JSON.stringify({
        name: '@beachball-comments-repro/package1',
        version: '0.0.1',
        description: 'A simple repro.',
        beachball: {
          disallowedChangeTypes: ['major'],
        },
      })
    );
    repo.commitChange(
      'packages/package2/package.json',
      JSON.stringify({
        name: '@beachball-comments-repro/package2',
        version: '0.0.1',
        description: 'A simple repro.',
        beachball: {
          disallowedChangeTypes: ['major'],
        },
        dependencies: {
          '@beachball-comments-repro/package1': '^0.0.1',
        },
      })
    );

    repo.commitChange(
      'change/@beachball-comments-repro-package1.json',
      JSON.stringify({
        type: 'patch',
        comment: 'This package1 test comment should be absorbed into the changelog.',
        packageName: '@beachball-comments-repro/package1',
        email: 'jagore@microsoft.com',
        dependentChangeType: 'patch',
      })
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      generateChangelog: true,
    } as BeachballOptions);

    const changelogJsonFile = path.join(repo.rootPath, 'packages', 'package2', 'CHANGELOG.json');
    const jsonText = fs.readFileSync(changelogJsonFile, { encoding: 'utf-8' });
    const changelogJson = JSON.parse(jsonText);

    expect(changelogJson.entries[0].comments.patch[0].comment).toBe(
      'Bump @beachball-comments-repro/package1 to v0.0.2'
    );
  });

  it('will generate correct bumpInfo.modifiedPackages with dep bumps', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'package.json',
      JSON.stringify({
        name: 'beachball-comments-repro',
        version: '1.0.0',
        license: 'UNLICENSED',
        workspaces: {
          packages: ['packages/*'],
        },
        private: true,
        repository: {
          type: 'git',
        },
      })
    );

    repo.commitChange(
      'packages/package1/package.json',
      JSON.stringify({
        name: '@beachball-comments-repro/package1',
        version: '0.0.1',
        description: 'A simple repro.',
        beachball: {
          disallowedChangeTypes: ['major'],
        },
      })
    );
    repo.commitChange(
      'packages/package2/package.json',
      JSON.stringify({
        name: '@beachball-comments-repro/package2',
        version: '0.0.1',
        description: 'A simple repro.',
        beachball: {
          disallowedChangeTypes: ['major'],
        },
        dependencies: {
          '@beachball-comments-repro/package1': '^0.0.1',
        },
      })
    );

    repo.commitChange(
      'change/@beachball-comments-repro-package1.json',
      JSON.stringify({
        type: 'patch',
        comment: 'This package1 test comment should be absorbed into the changelog.',
        packageName: '@beachball-comments-repro/package1',
        email: 'jagore@microsoft.com',
        dependentChangeType: 'patch',
      })
    );

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    const bumpInfo = await bump({
      path: repo.rootPath,
      bumpDeps: true,
      keepChangeFiles: false,
      generateChangelog: true,
    } as BeachballOptions);

    const modified = [...bumpInfo.modifiedPackages];
    expect(modified).toContain('@beachball-comments-repro/package1');
    expect(modified).toContain('@beachball-comments-repro/package2');
  });

  it('calls sync prebump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    let prebumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        prebump: (packagePath, name, version) => {
          prebumpCalled = true;
          expect(packagePath.endsWith(path.sep + path.join('packages', 'pkg-1')));
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
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    let prebumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        prebump: async (packagePath, name, version) => {
          prebumpCalled = true;
          expect(packagePath.endsWith(path.sep + path.join('packages', 'pkg-1')));
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect((await fs.readJSON(jsonPath)).version).toBe('1.0.0');
        },
      },
    } as BeachballOptions);

    expect(prebumpCalled).toBe(true);
  });

  it('calls sync postbump hook before packages are bumped', async () => {
    repositoryFactory = new RepositoryFactory();
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    let postBumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        postbump: (packagePath, name, version) => {
          postBumpCalled = true;
          expect(packagePath.endsWith(path.sep + path.join('packages', 'pkg-1')));
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
    repositoryFactory.create();
    const repo = repositoryFactory.cloneRepository();

    repo.commitChange(
      'packages/pkg-1/package.json',
      JSON.stringify({
        name: 'pkg-1',
        version: '1.0.0',
      })
    );

    writeChangeFiles({
      changes: [
        {
          type: 'minor',
          comment: 'test',
          email: 'test@test.com',
          packageName: 'pkg-1',
          dependentChangeType: 'patch',
        },
      ],
      cwd: repo.rootPath,
    });

    git(['push', 'origin', 'master'], { cwd: repo.rootPath });

    let postbumpCalled = false;

    await bump({
      path: repo.rootPath,
      bumpDeps: false,
      hooks: {
        postbump: async (packagePath, name, version) => {
          postbumpCalled = true;
          expect(packagePath.endsWith(path.sep + path.join('packages', 'pkg-1')));
          expect(name).toBe('pkg-1');
          expect(version).toBe('1.1.0');

          const jsonPath = path.join(packagePath, 'package.json');
          expect((await fs.readJSON(jsonPath)).version).toBe('1.1.0');
        },
      },
    } as BeachballOptions);

    expect(postbumpCalled).toBe(true);
  });
});
