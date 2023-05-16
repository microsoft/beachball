import { describe, expect, it, beforeAll, afterAll, afterEach } from '@jest/globals';
import fs from 'fs-extra';
import { gitFailFast } from 'workspace-tools';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { tmpdir } from '../../__fixtures__/tmpdir';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { PackageInfos } from '../../types/PackageInfo';
import { getDefaultOptions } from '../../options/getDefaultOptions';
import { initMockLogs } from '../../__fixtures__/mockLogs';

const defaultOptions = getDefaultOptions();

/** Strip the root path from the file path and normalize slashes */
function cleanPath(root: string, filePath: string) {
  root = root.replace(/\\/g, '/');
  return filePath.replace(/\\/g, '/').replace(root, '').slice(1);
}

/** Strip unneeded info from the result of `getPackageInfos` before taking snapshots */
function cleanPackageInfos(root: string, packageInfos: PackageInfos) {
  const cleanedInfos: PackageInfos = {};
  for (const [pkgName, originalInfo] of Object.entries(packageInfos)) {
    // Make a copy deep enough to cover anything that will be modified
    const pkgInfo = (cleanedInfos[pkgName] = { ...originalInfo, combinedOptions: { ...originalInfo.combinedOptions } });

    // Remove absolute paths
    pkgInfo.packageJsonPath = cleanPath(root, pkgInfo.packageJsonPath);

    // Remove beachball options which are defaulted
    for (const [key, value] of Object.entries(pkgInfo.combinedOptions)) {
      if (value === (defaultOptions as any)[key]) {
        delete (pkgInfo.combinedOptions as any)[key];
      }
    }

    // Remove options set to undefined or empty object (keep null because it may be meaningful/interesting)
    for (const [key, value] of Object.entries(pkgInfo)) {
      if (value === undefined || (value && typeof value === 'object' && !Object.keys(value).length)) {
        delete (pkgInfo as any)[key];
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
  let multiWorkspaceFactory: RepositoryFactory;
  let tempDir: string | undefined;
  const logs = initMockLogs();

  beforeAll(() => {
    singleFactory = new RepositoryFactory('single');
    monorepoFactory = new RepositoryFactory('monorepo');
    multiWorkspaceFactory = new RepositoryFactory('multi-workspace');
  });

  afterEach(() => {
    tempDir && fs.removeSync(tempDir);
    tempDir = undefined;
  });

  afterAll(() => {
    singleFactory.cleanUp();
    monorepoFactory.cleanUp();
    multiWorkspaceFactory.cleanUp();
  });

  it('throws if run outside a git repo', () => {
    tempDir = tmpdir();
    expect(() => getPackageInfos(tempDir!)).toThrow(/not in a git repository/);
  });

  it('returns empty object if no packages are found', () => {
    tempDir = tmpdir();
    gitFailFast(['init'], { cwd: tempDir });
    expect(getPackageInfos(tempDir)).toEqual({});
  });

  it('works in single-package repo', () => {
    const repo = singleFactory.cloneRepository();
    let packageInfos = getPackageInfos(repo.rootPath);
    packageInfos = cleanPackageInfos(repo.rootPath, packageInfos);
    expect(packageInfos).toMatchInlineSnapshot(`
      {
        "foo": {
          "dependencies": {
            "bar": "1.0.0",
            "baz": "1.0.0",
          },
          "name": "foo",
          "packageJsonPath": "package.json",
          "private": false,
          "version": "1.0.0",
        },
      }
    `);
  });

  // both yarn and npm define "workspaces" in package.json
  it('works in yarn/npm monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    let packageInfos = getPackageInfos(repo.rootPath);
    packageInfos = cleanPackageInfos(repo.rootPath, packageInfos);
    expect(packageInfos).toMatchInlineSnapshot(`
      {
        "a": {
          "name": "a",
          "packageJsonPath": "packages/grouped/a/package.json",
          "private": false,
          "version": "3.1.2",
        },
        "b": {
          "name": "b",
          "packageJsonPath": "packages/grouped/b/package.json",
          "private": false,
          "version": "3.1.2",
        },
        "bar": {
          "dependencies": {
            "baz": "^1.3.4",
          },
          "name": "bar",
          "packageJsonPath": "packages/bar/package.json",
          "private": false,
          "version": "1.3.4",
        },
        "baz": {
          "name": "baz",
          "packageJsonPath": "packages/baz/package.json",
          "private": false,
          "version": "1.3.4",
        },
        "foo": {
          "dependencies": {
            "bar": "^1.3.4",
          },
          "name": "foo",
          "packageJsonPath": "packages/foo/package.json",
          "private": false,
          "version": "1.0.0",
        },
      }
    `);
  });

  it('works in pnpm monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    fs.writeJSONSync(repo.pathTo('package.json'), { name: 'pnpm-monorepo', version: '1.0.0', private: true });
    fs.writeFileSync(repo.pathTo('pnpm-lock.yaml'), '');
    fs.writeFileSync(repo.pathTo('pnpm-workspace.yaml'), 'packages: ["packages/*", "packages/grouped/*"]');

    const rootPackageInfos = getPackageInfos(repo.rootPath);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toMatchInlineSnapshot(`
      {
        "a": "packages/grouped/a/package.json",
        "b": "packages/grouped/b/package.json",
        "bar": "packages/bar/package.json",
        "baz": "packages/baz/package.json",
        "foo": "packages/foo/package.json",
        "pnpm-monorepo": "package.json",
      }
    `);
  });

  it('works in rush monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    fs.writeJSONSync(repo.pathTo('package.json'), { name: 'rush-monorepo', version: '1.0.0', private: true });
    fs.writeJSONSync(repo.pathTo('rush.json'), {
      projects: [{ projectFolder: 'packages' }, { projectFolder: 'packages/grouped' }],
    });

    const rootPackageInfos = getPackageInfos(repo.rootPath);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toMatchInlineSnapshot(`
      {
        "a": "packages/grouped/a/package.json",
        "b": "packages/grouped/b/package.json",
        "bar": "packages/bar/package.json",
        "baz": "packages/baz/package.json",
        "foo": "packages/foo/package.json",
        "rush-monorepo": "package.json",
      }
    `);
  });

  it('works in lerna monorepo', () => {
    const repo = monorepoFactory.cloneRepository();
    fs.writeJSONSync(repo.pathTo('package.json'), { name: 'lerna-monorepo', version: '1.0.0', private: true });
    fs.writeJSONSync(repo.pathTo('lerna.json'), { packages: ['packages/*', 'packages/grouped/*'] });

    const rootPackageInfos = getPackageInfos(repo.rootPath);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toMatchInlineSnapshot(`
      {
        "a": "packages/grouped/a/package.json",
        "b": "packages/grouped/b/package.json",
        "bar": "packages/bar/package.json",
        "baz": "packages/baz/package.json",
        "foo": "packages/foo/package.json",
      }
    `);
  });

  it('works multi-workspace monorepo', () => {
    const repo = multiWorkspaceFactory.cloneRepository();

    // For this test, only snapshot the package names and paths
    const rootPackageInfos = getPackageInfos(repo.rootPath);
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toMatchInlineSnapshot(`
      {
        "@workspace-a/a": "workspace-a/packages/grouped/a/package.json",
        "@workspace-a/b": "workspace-a/packages/grouped/b/package.json",
        "@workspace-a/bar": "workspace-a/packages/bar/package.json",
        "@workspace-a/baz": "workspace-a/packages/baz/package.json",
        "@workspace-a/foo": "workspace-a/packages/foo/package.json",
        "@workspace-a/monorepo-fixture": "workspace-a/package.json",
        "@workspace-b/a": "workspace-b/packages/grouped/a/package.json",
        "@workspace-b/b": "workspace-b/packages/grouped/b/package.json",
        "@workspace-b/bar": "workspace-b/packages/bar/package.json",
        "@workspace-b/baz": "workspace-b/packages/baz/package.json",
        "@workspace-b/foo": "workspace-b/packages/foo/package.json",
        "@workspace-b/monorepo-fixture": "workspace-b/package.json",
      }
    `);

    const workspaceARoot = repo.pathTo('workspace-a');
    const packageInfosA = getPackageInfos(workspaceARoot);
    expect(getPackageNamesAndPaths(workspaceARoot, packageInfosA)).toMatchInlineSnapshot(`
      {
        "@workspace-a/a": "packages/grouped/a/package.json",
        "@workspace-a/b": "packages/grouped/b/package.json",
        "@workspace-a/bar": "packages/bar/package.json",
        "@workspace-a/baz": "packages/baz/package.json",
        "@workspace-a/foo": "packages/foo/package.json",
      }
    `);

    const workspaceBRoot = repo.pathTo('workspace-b');
    const packageInfosB = getPackageInfos(workspaceBRoot);
    expect(getPackageNamesAndPaths(workspaceBRoot, packageInfosB)).toMatchInlineSnapshot(`
      {
        "@workspace-b/a": "packages/grouped/a/package.json",
        "@workspace-b/b": "packages/grouped/b/package.json",
        "@workspace-b/bar": "packages/bar/package.json",
        "@workspace-b/baz": "packages/baz/package.json",
        "@workspace-b/foo": "packages/foo/package.json",
      }
    `);
  });

  it('throws if multiple packages have the same name in multi-workspace monorepo', () => {
    // If there are multiple workspaces in a monorepo, it's possible that two packages in different
    // workspaces could share the same name, which causes problems for beachball.
    // (This is only known to have been an issue with the test fixture, but is worth testing.)
    const repo = multiWorkspaceFactory.cloneRepository();
    repo.updateJsonFile('workspace-a/packages/foo/package.json', { name: 'foo' });
    repo.updateJsonFile('workspace-b/packages/foo/package.json', { name: 'foo' });

    expect(() => getPackageInfos(repo.rootPath)).toThrow('Duplicate package names found (see above for details)');

    const allLogs = logs.getMockLines('all').replace(/\\/g, '/');
    expect(allLogs).toMatchInlineSnapshot(`
      "[error] ERROR: Two packages have the same name "foo". Please rename one of these packages:
      - workspace-a/packages/foo/package.json
      - workspace-b/packages/foo/package.json"
    `);
  });
});
