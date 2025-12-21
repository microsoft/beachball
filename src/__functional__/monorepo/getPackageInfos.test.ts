import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs';
import { gitFailFast } from 'workspace-tools';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import type { PackageInfos, PackageInfo } from '../../types/PackageInfo';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import type { PackageOptions } from '../../types/BeachballOptions';
import { cloneObject } from '../../object/cloneObject';
import { getParsedOptions } from '../../options/getOptions';
import { defaultRemoteBranchName } from '../../__fixtures__/gitDefaults';
import { writeJson } from '../../object/writeJson';

const defaultOptions = getDefaultOptions();

/** Replace the root path with `<root>` and normalize slashes */
function cleanPath(root: string, filePath: string) {
  // Using a <root> token verifies the paths are absolute
  root = root.replace(/\\/g, '/');
  return filePath.replace(/\\/g, '/').replace(root, '<root>');
}

/** Strip unneeded info from the result of `getPackageInfos` before taking snapshots */
function cleanPackageInfos(root: string, packageInfos: PackageInfos) {
  const cleanedInfos: PackageInfos = {};
  for (const [pkgName, originalInfo] of Object.entries(packageInfos)) {
    const pkgInfo = (cleanedInfos[pkgName] = cloneObject(originalInfo));

    // Remove absolute paths
    pkgInfo.packageJsonPath = cleanPath(root, pkgInfo.packageJsonPath);

    // Remove beachball options which are defaulted
    for (const [key, value] of Object.entries(pkgInfo.combinedOptions)) {
      if (value === defaultOptions[key as keyof PackageOptions]) {
        delete pkgInfo.combinedOptions[key as keyof PackageOptions];
      }
    }

    // Remove options set to undefined or empty object (keep null because it may be meaningful/interesting)
    for (const [key, value] of Object.entries(pkgInfo)) {
      if (value === undefined || (value && typeof value === 'object' && !Object.keys(value as object).length)) {
        delete pkgInfo[key as keyof PackageInfo];
      }
    }
  }

  return cleanedInfos;
}

/** Return an object mapping package names to package.json paths */
function getPackageNamesAndPaths(root: string, packageInfos: PackageInfos) {
  return Object.fromEntries(
    Object.entries(packageInfos).map(([name, pkg]) => [name, cleanPath(root, pkg.packageJsonPath)])
  );
}

describe('getPackageInfos', () => {
  // factories can be reused between these tests because none of them push changes
  let singleFactory: RepositoryFactory;
  let monorepoFactory: RepositoryFactory;
  let multiProjectFactory: RepositoryFactory;
  let tempDir: string | undefined;
  const logs = initMockLogs();

  function getOptions(cwd: string) {
    return getParsedOptions({
      cwd,
      argv: [],
      testRepoOptions: { branch: defaultRemoteBranchName }, // skip trying to read this from git
    });
  }

  beforeAll(() => {
    singleFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory('monorepo');
    multiProjectFactory = new RepositoryFactory('multi-project');
  });

  afterEach(() => {
    removeTempDir(tempDir);
    tempDir = undefined;
  });

  afterAll(() => {
    singleFactory.cleanUp();
    monorepoFactory.cleanUp();
    multiProjectFactory.cleanUp();
  });

  // This is irrelevant with the new signature because the exception would have been thrown when
  // the options were being parsed.
  it('throws if run outside a git repo (old signature)', () => {
    tempDir = tmpdir();
    // eslint-disable-next-line etc/no-deprecated
    expect(() => getPackageInfos(tempDir!)).toThrow(/not in a git repository/);
  });

  it('returns empty object if no packages are found', () => {
    tempDir = tmpdir();
    gitFailFast(['init'], { cwd: tempDir });
    // eslint-disable-next-line etc/no-deprecated
    expect(getPackageInfos(tempDir)).toEqual({});
    expect(getPackageInfos({ cliOptions: { path: tempDir, command: '' }, repoOptions: {} })).toEqual({});
  });

  it('works in single-package repo (old signature)', () => {
    const repo = singleFactory.cloneRepository();
    // eslint-disable-next-line etc/no-deprecated
    let packageInfos = getPackageInfos(repo.rootPath);
    packageInfos = cleanPackageInfos(repo.rootPath, packageInfos);
    expect(packageInfos).toEqual({
      foo: {
        dependencies: { bar: '1.0.0', baz: '1.0.0' },
        name: 'foo',
        packageJsonPath: '<root>/package.json',
        private: false,
        version: '1.0.0',
      },
    });
  });

  it('works in single-package repo', () => {
    const repo = singleFactory.cloneRepository();
    const parsedOptions = getOptions(repo.rootPath);
    let packageInfos = getPackageInfos(parsedOptions);
    packageInfos = cleanPackageInfos(repo.rootPath, packageInfos);
    expect(packageInfos).toEqual({
      foo: {
        dependencies: { bar: '1.0.0', baz: '1.0.0' },
        name: 'foo',
        packageJsonPath: '<root>/package.json',
        private: false,
        version: '1.0.0',
      },
    });
  });

  const expectedYarnPackages: Record<string, Partial<PackageInfo>> = {
    a: { name: 'a', version: '3.1.2', private: false, packageJsonPath: '<root>/packages/grouped/a/package.json' },
    b: { name: 'b', version: '3.1.2', private: false, packageJsonPath: '<root>/packages/grouped/b/package.json' },
    bar: {
      dependencies: { baz: '^1.3.4' },
      name: 'bar',
      packageJsonPath: '<root>/packages/bar/package.json',
      private: false,
      version: '1.3.4',
    },
    baz: { name: 'baz', version: '1.3.4', private: false, packageJsonPath: '<root>/packages/baz/package.json' },
    foo: {
      name: 'foo',
      version: '1.0.0',
      private: false,
      dependencies: { bar: '^1.3.4' },
      packageJsonPath: '<root>/packages/foo/package.json',
    },
  };

  // both yarn and npm define "workspaces" in package.json
  it('works in yarn/npm monorepo (old signature)', () => {
    const repo = monorepoFactory.cloneRepository();
    // eslint-disable-next-line etc/no-deprecated
    let packageInfos = getPackageInfos(repo.rootPath);
    packageInfos = cleanPackageInfos(repo.rootPath, packageInfos);
    expect(packageInfos).toEqual(expectedYarnPackages);
  });

  it('works in yarn/npm monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    const parsedOptions = getOptions(repo.rootPath);
    let packageInfos = getPackageInfos(parsedOptions);
    packageInfos = cleanPackageInfos(repo.rootPath, packageInfos);
    expect(packageInfos).toEqual(expectedYarnPackages);
  });

  it('works in pnpm monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    writeJson(repo.pathTo('package.json'), { name: 'pnpm-monorepo', version: '1.0.0', private: true });
    fs.writeFileSync(repo.pathTo('pnpm-lock.yaml'), '');
    fs.writeFileSync(repo.pathTo('pnpm-workspace.yaml'), 'packages: ["packages/*", "packages/grouped/*"]');
    const parsedOptions = getOptions(repo.rootPath);

    const rootPackageInfos = getPackageInfos(parsedOptions);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toEqual({
      a: '<root>/packages/grouped/a/package.json',
      b: '<root>/packages/grouped/b/package.json',
      bar: '<root>/packages/bar/package.json',
      baz: '<root>/packages/baz/package.json',
      foo: '<root>/packages/foo/package.json',
      'pnpm-monorepo': '<root>/package.json',
    });
  });

  it('works in rush monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    writeJson(repo.pathTo('package.json'), { name: 'rush-monorepo', version: '1.0.0', private: true });
    writeJson(repo.pathTo('rush.json'), {
      projects: [{ projectFolder: 'packages' }, { projectFolder: 'packages/grouped' }],
    });
    const parsedOptions = getOptions(repo.rootPath);

    const rootPackageInfos = getPackageInfos(parsedOptions);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toEqual({
      a: '<root>/packages/grouped/a/package.json',
      b: '<root>/packages/grouped/b/package.json',
      bar: '<root>/packages/bar/package.json',
      baz: '<root>/packages/baz/package.json',
      foo: '<root>/packages/foo/package.json',
      'rush-monorepo': '<root>/package.json',
    });
  });

  it('works in lerna monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    writeJson(repo.pathTo('package.json'), { name: 'lerna-monorepo', version: '1.0.0', private: true });
    writeJson(repo.pathTo('lerna.json'), { packages: ['packages/*', 'packages/grouped/*'] });
    const parsedOptions = getOptions(repo.rootPath);

    const rootPackageInfos = getPackageInfos(parsedOptions);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toEqual({
      a: '<root>/packages/grouped/a/package.json',
      b: '<root>/packages/grouped/b/package.json',
      bar: '<root>/packages/bar/package.json',
      baz: '<root>/packages/baz/package.json',
      foo: '<root>/packages/foo/package.json',
    });
  });

  it('works in multi-project monorepo', () => {
    const repo = multiProjectFactory.cloneRepository();

    // For this test, only snapshot the package names and paths
    const rootOptions = getOptions(repo.rootPath);
    const rootPackageInfos = getPackageInfos(rootOptions);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toEqual({
      '@project-a/a': '<root>/project-a/packages/grouped/a/package.json',
      '@project-a/b': '<root>/project-a/packages/grouped/b/package.json',
      '@project-a/bar': '<root>/project-a/packages/bar/package.json',
      '@project-a/baz': '<root>/project-a/packages/baz/package.json',
      '@project-a/foo': '<root>/project-a/packages/foo/package.json',
      '@project-a/monorepo-fixture': '<root>/project-a/package.json',
      '@project-b/a': '<root>/project-b/packages/grouped/a/package.json',
      '@project-b/b': '<root>/project-b/packages/grouped/b/package.json',
      '@project-b/bar': '<root>/project-b/packages/bar/package.json',
      '@project-b/baz': '<root>/project-b/packages/baz/package.json',
      '@project-b/foo': '<root>/project-b/packages/foo/package.json',
      '@project-b/monorepo-fixture': '<root>/project-b/package.json',
    });

    const projectARoot = repo.pathTo('project-a');
    const projectAOptions = getOptions(projectARoot);
    const packageInfosA = getPackageInfos(projectAOptions);
    expect(getPackageNamesAndPaths(projectARoot, packageInfosA)).toEqual({
      '@project-a/a': '<root>/packages/grouped/a/package.json',
      '@project-a/b': '<root>/packages/grouped/b/package.json',
      '@project-a/bar': '<root>/packages/bar/package.json',
      '@project-a/baz': '<root>/packages/baz/package.json',
      '@project-a/foo': '<root>/packages/foo/package.json',
    });

    const projectBRoot = repo.pathTo('project-b');
    const projectBOptions = getOptions(projectBRoot);
    const packageInfosB = getPackageInfos(projectBOptions);
    expect(getPackageNamesAndPaths(projectBRoot, packageInfosB)).toEqual({
      '@project-b/a': '<root>/packages/grouped/a/package.json',
      '@project-b/b': '<root>/packages/grouped/b/package.json',
      '@project-b/bar': '<root>/packages/bar/package.json',
      '@project-b/baz': '<root>/packages/baz/package.json',
      '@project-b/foo': '<root>/packages/foo/package.json',
    });
  });

  it('throws if multiple packages have the same name in multi-project monorepo', () => {
    // If there are multiple projects in a monorepo, it's possible that two packages in different
    // projects could share the same name, which causes problems for beachball.
    // (This is only known to have been an issue with the test fixture, but is worth testing.)
    const repo = multiProjectFactory.cloneRepository();
    repo.updateJsonFile('project-a/packages/foo/package.json', { name: 'foo' });
    repo.updateJsonFile('project-b/packages/foo/package.json', { name: 'foo' });
    const parsedOptions = getOptions(repo.rootPath);
    expect(() => getPackageInfos(parsedOptions)).toThrow('Duplicate package names found (see above for details)');

    const allLogs = logs.getMockLines('all', { root: repo.rootPath }); // normalizes slashes too
    expect(allLogs).toMatchInlineSnapshot(`
      "[error] ERROR: Two packages have the same name "foo". Please rename one of these packages:
      - project-a/packages/foo/package.json
      - project-b/packages/foo/package.json"
    `);
  });
});
