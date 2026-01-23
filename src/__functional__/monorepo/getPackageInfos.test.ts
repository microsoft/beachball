import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { getWorkspaceManagerRoot, gitFailFast } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { RepositoryFactory } from '../../__fixtures__/repositoryFactory';
import { removeTempDir, tmpdir } from '../../__fixtures__/tmpdir';
import { getPackageInfos } from '../../monorepo/getPackageInfos';
import { cloneObject } from '../../object/cloneObject';
import { writeJson } from '../../object/writeJson';
import type { PackageInfo, PackageInfos } from '../../types/PackageInfo';
import { createTestFileStructureType } from '../../__fixtures__/createTestFileStructure';

/** Replace the root path with `<root>` and normalize slashes */
function cleanPath(root: string, filePath: string) {
  // Using a <root> token verifies the paths are absolute
  root = root.replace(/\\/g, '/');
  return filePath.replace(/\\/g, '/').replace(root, '<root>');
}

/** Sanitize paths in the result of `getPackageInfos` */
function cleanPaths(root: string, packageInfos: PackageInfos) {
  const cleanedInfos: PackageInfos = {};
  for (const [pkgName, originalInfo] of Object.entries(packageInfos)) {
    cleanedInfos[pkgName] = {
      ...cloneObject(originalInfo),
      packageJsonPath: cleanPath(root, originalInfo.packageJsonPath),
    };
  }
  return cleanedInfos;
}

/** Return an object mapping package names to sanitized package.json paths */
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
  it('throws if neither project root nor git repo found (old signature)', () => {
    tempDir = tmpdir();
    // eslint-disable-next-line etc/no-deprecated
    expect(() => getPackageInfos(tempDir!)).toThrow(/not in a git repository/);
  });

  it('returns empty object if no packages are found', () => {
    tempDir = tmpdir();
    gitFailFast(['init'], { cwd: tempDir });
    // eslint-disable-next-line etc/no-deprecated
    expect(getPackageInfos(tempDir)).toEqual({});
    expect(getPackageInfos({ cliOptions: {}, options: { path: tempDir } })).toEqual({});
  });

  it('works in single-package repo (old signature)', () => {
    const repo = singleFactory.cloneRepository();
    // eslint-disable-next-line etc/no-deprecated
    const packageInfos = getPackageInfos(repo.rootPath);
    // Verify all the properties for this case
    expect(packageInfos).toEqual({
      foo: {
        name: 'foo',
        version: '1.0.0',
        dependencies: { bar: '1.0.0', baz: '1.0.0' },
        packageJsonPath: path.join(repo.rootPath, 'package.json'),
      },
    });
  });

  it('works in single-package repo', () => {
    // With the new signature, path is assumed to be the root, so git isn't needed
    tempDir = createTestFileStructureType('single');
    const packageInfos = getPackageInfos({ cliOptions: {}, options: { path: tempDir } });
    expect(packageInfos).toEqual({
      foo: {
        name: 'foo',
        version: '1.0.0',
        dependencies: { bar: '1.0.0', baz: '1.0.0' },
        packageJsonPath: path.join(tempDir, 'package.json'),
      },
    });
  });

  const expectedYarnPackages: Record<string, Partial<PackageInfo>> = {
    a: { name: 'a', version: '3.1.2', packageJsonPath: '<root>/packages/grouped/a/package.json' },
    b: { name: 'b', version: '3.1.2', packageJsonPath: '<root>/packages/grouped/b/package.json' },
    // prettier-ignore
    bar: { name: 'bar', version: '1.3.4',  dependencies: { baz: '^1.3.4' }, packageJsonPath: '<root>/packages/bar/package.json' },
    baz: { name: 'baz', version: '1.3.4', packageJsonPath: '<root>/packages/baz/package.json' },
    // prettier-ignore
    foo: { name: 'foo', version: '1.0.0',  dependencies: { bar: '^1.3.4' }, packageJsonPath: '<root>/packages/foo/package.json' },
  };

  // both yarn and npm define "workspaces" in package.json
  it('works in yarn/npm monorepo (old signature)', () => {
    const repo = monorepoFactory.cloneRepository();
    // Start from another cwd to make sure it works
    // eslint-disable-next-line etc/no-deprecated
    const packageInfos = getPackageInfos(repo.pathTo('packages/foo'));
    expect(cleanPaths(repo.rootPath, packageInfos)).toEqual(expectedYarnPackages);
  });

  it('works in yarn/npm monorepo', () => {
    // With the new signature, path is assumed to be the root, so git isn't needed
    tempDir = createTestFileStructureType('monorepo');
    // The new signature assumes options where the root was already found
    const packageInfos = getPackageInfos({ cliOptions: {}, options: { path: tempDir } });
    expect(cleanPaths(tempDir, packageInfos)).toEqual(expectedYarnPackages);
  });

  it('works in pnpm monorepo', () => {
    tempDir = createTestFileStructureType('monorepo');
    writeJson(path.join(tempDir, 'package.json'), { name: 'pnpm-monorepo', version: '1.0.0', private: true });
    fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
    // In this test, omit the grouped packages to ensure it's using the provided globs
    fs.writeFileSync(path.join(tempDir, 'pnpm-workspace.yaml'), 'packages: ["packages/*"]');
    fs.rmSync(path.join(tempDir, 'yarn.lock'));
    // Verify manager is detected
    expect(getWorkspaceManagerRoot(path.join(tempDir, 'packages/foo'))).toEqual(tempDir);

    const rootPackageInfos = getPackageInfos({ cliOptions: {}, options: { path: tempDir } });
    expect(getPackageNamesAndPaths(tempDir, rootPackageInfos)).toEqual({
      bar: '<root>/packages/bar/package.json',
      baz: '<root>/packages/baz/package.json',
      foo: '<root>/packages/foo/package.json',
    });
  });

  it('works in rush monorepo', () => {
    tempDir = createTestFileStructureType('monorepo');
    writeJson(path.join(tempDir, 'package.json'), { name: 'rush-monorepo', version: '1.0.0', private: true });
    writeJson(path.join(tempDir, 'rush.json'), {
      // In this test, only use certain packages (rush doesn't support globs)
      projects: [{ projectFolder: 'packages/foo' }, { projectFolder: 'packages/bar' }],
    });
    fs.rmSync(path.join(tempDir, 'yarn.lock'));
    // Verify manager is detected
    expect(getWorkspaceManagerRoot(path.join(tempDir, 'packages/foo'))).toEqual(tempDir);

    const rootPackageInfos = getPackageInfos({ cliOptions: {}, options: { path: tempDir } });
    expect(getPackageNamesAndPaths(tempDir, rootPackageInfos)).toEqual({
      bar: '<root>/packages/bar/package.json',
      foo: '<root>/packages/foo/package.json',
    });
  });

  it('works in lerna monorepo', () => {
    tempDir = createTestFileStructureType('monorepo');
    writeJson(path.join(tempDir, 'package.json'), { name: 'lerna-monorepo', version: '1.0.0', private: true });
    // In this test, omit the grouped packages to ensure it's using the provided config
    writeJson(path.join(tempDir, 'lerna.json'), { packages: ['packages/*'] });
    fs.rmSync(path.join(tempDir, 'yarn.lock'));
    // Verify manager is detected
    expect(getWorkspaceManagerRoot(path.join(tempDir, 'packages/foo'))).toEqual(tempDir);

    const rootPackageInfos = getPackageInfos({ cliOptions: {}, options: { path: tempDir } });
    expect(getPackageNamesAndPaths(tempDir, rootPackageInfos)).toEqual({
      bar: '<root>/packages/bar/package.json',
      baz: '<root>/packages/baz/package.json',
      foo: '<root>/packages/foo/package.json',
    });
  });

  it('respects ignorePatterns in regular monorepo', () => {
    tempDir = createTestFileStructureType('monorepo');

    const rootPackageInfos = getPackageInfos({
      cliOptions: {},
      options: { path: tempDir, ignorePatterns: ['packages/b*/**'] },
    });
    expect(getPackageNamesAndPaths(tempDir, rootPackageInfos)).toEqual({
      a: '<root>/packages/grouped/a/package.json',
      b: '<root>/packages/grouped/b/package.json',
      foo: '<root>/packages/foo/package.json',
    });
  });

  it('works in non-managed monorepo (and respects ignorePatterns)', () => {
    // This one needs git so it can use git ls-files to find packages
    const repo = monorepoFactory.cloneRepository();
    // Remove workspace config to simulate a non-managed monorepo
    writeJson(path.join(repo.rootPath, 'package.json'), { name: 'monorepo', version: '1.0.0', private: true });
    fs.rmSync(path.join(repo.rootPath, 'yarn.lock'));
    // Verify no manager is detected
    expect(getWorkspaceManagerRoot(path.join(repo.rootPath, 'packages/foo'))).toBeUndefined();

    const rootPackageInfos = getPackageInfos({
      cliOptions: {},
      // Ignore bar and baz
      options: { ignorePatterns: ['packages/b*/**'], path: repo.rootPath },
    });
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toEqual({
      a: '<root>/packages/grouped/a/package.json',
      b: '<root>/packages/grouped/b/package.json',
      foo: '<root>/packages/foo/package.json',
      // In this case it should include the root for reasons explained in getPackageInfos
      monorepo: '<root>/package.json',
    });
  });

  it('works in beachball-like repo', () => {
    // The beachball repo is a single package with a separately-managed "docs" folder which is ignored
    const repo = singleFactory.cloneRepository();
    repo.writeFile('docs/package.json', { name: 'docs', version: '1.0.0', private: true });
    repo.writeFile('docs/yarn.lock', '');
    repo.commitAll('add docs folder');

    const rootPackageInfos = getPackageInfos({
      cliOptions: {},
      options: { path: repo.rootPath, ignorePatterns: ['docs/**'] },
    });
    expect(getPackageNamesAndPaths(repo.rootPath, rootPackageInfos)).toEqual({
      foo: '<root>/package.json',
    });
  });

  it('works in multi-project monorepo', () => {
    // The first part of the multi-monorepo test needs git since the fallback to find package.jsons
    // is using git ls-files
    const repo = multiProjectFactory.cloneRepository();

    // For this test, only snapshot the package names and paths
    const rootPackageInfos = getPackageInfos({ cliOptions: {}, options: { path: repo.rootPath } });
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
    const packageInfosA = getPackageInfos({ cliOptions: {}, options: { path: projectARoot } });
    expect(getPackageNamesAndPaths(projectARoot, packageInfosA)).toEqual({
      '@project-a/a': '<root>/packages/grouped/a/package.json',
      '@project-a/b': '<root>/packages/grouped/b/package.json',
      '@project-a/bar': '<root>/packages/bar/package.json',
      '@project-a/baz': '<root>/packages/baz/package.json',
      '@project-a/foo': '<root>/packages/foo/package.json',
    });

    const projectBRoot = repo.pathTo('project-b');
    const packageInfosB = getPackageInfos({ cliOptions: {}, options: { path: projectBRoot } });
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
    expect(() => getPackageInfos({ cliOptions: {}, options: { path: repo.rootPath } })).toThrow(
      'Duplicate package names found (see above for details)'
    );

    const allLogs = logs.getMockLines('all', { root: repo.rootPath }); // normalizes slashes too
    expect(allLogs).toMatchInlineSnapshot(`
      "[error] ERROR: Two packages have the same name "foo". Please rename one of these packages:
      - project-a/packages/foo/package.json
      - project-b/packages/foo/package.json"
    `);
  });
});
