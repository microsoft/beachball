import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import path from 'path';
import { generateChangeSet, type PartialChangeFile } from '../../__fixtures__/changeFiles';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { mockProcessExit } from '../../__fixtures__/mockProcessExit';
import { makePackageInfosByFolder, type PartialPackageInfo } from '../../__fixtures__/packageInfos';
import { bumpInMemory } from '../../bump/bumpInMemory';
import { getParsedOptions } from '../../options/getOptions';
import type { RepoOptions } from '../../types/BeachballOptions';
import { getScopedPackages } from '../../monorepo/getScopedPackages';
import { getPackageGroups } from '../../monorepo/getPackageGroups';

describe('bumpInMemory', () => {
  const logs = initMockLogs();
  const cwd = path.resolve('/fake-root');

  function gatherBumpInfoWrapper(params: {
    packageFolders: { [folder: string]: PartialPackageInfo };
    repoOptions?: Partial<RepoOptions>;
    changes: (string | PartialChangeFile)[];
  }) {
    const { cliOptions, options } = getParsedOptions({
      cwd,
      argv: [],
      testRepoOptions: params.repoOptions,
    });
    const originalPackageInfos = makePackageInfosByFolder({
      packages: params.packageFolders,
      cwd,
      cliOptions,
    });
    const changeSet = generateChangeSet(params.changes);
    const scopedPackages = getScopedPackages(options, originalPackageInfos);
    const packageGroups = getPackageGroups(originalPackageInfos, cwd, options.groups);

    const bumpInfo = bumpInMemory(options, { originalPackageInfos, changeSet, scopedPackages, packageGroups });

    return { bumpInfo, options, originalPackageInfos };
  }

  beforeAll(() => {
    // getPackageGroups currently can call process.exit
    mockProcessExit(logs);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('bumps only packages with change files with bumpDeps: false', () => {
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
        'pkg-5': { version: '1.0.0', optionalDependencies: { 'pkg-4': '1.0.0' } },
      },
      repoOptions: { bumpDeps: false },
      changes: [{ packageName: 'pkg-1', type: 'minor' }],
    });
    const { packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;

    // Only pkg-1 actually gets bumped
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'minor' });
    // But currently, pkg-2 ends up in the modified list and dependentChangedBy via setDependentVersions.
    // It's debatable whether this is correct: https://github.com/microsoft/beachball/issues/620#issuecomment-3609264966
    expect(modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2']));
    expect(dependentChangedBy).toEqual({ 'pkg-2': new Set(['pkg-1']) });

    const pkg1NewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(originalPackageInfos['pkg-2'].version);
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);

    // these have no direct dep on pkg-1, so are unaffected
    expect(packageInfos['pkg-3']).toEqual(originalPackageInfos['pkg-3']);
    expect(packageInfos['pkg-4']).toEqual(originalPackageInfos['pkg-4']);
    expect(packageInfos['pkg-5']).toEqual(originalPackageInfos['pkg-5']);
  });

  it('bumps all dependent packages with bumpDeps: true', () => {
    const { bumpInfo } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
        'pkg-4': { version: '1.0.0', peerDependencies: { 'pkg-3': '1.0.0' } },
        'pkg-5': { version: '1.0.0', optionalDependencies: { 'pkg-4': '1.0.0' } },
      },
      repoOptions: { bumpDeps: true },
      changes: [{ packageName: 'pkg-1', type: 'minor' }],
    });
    const { packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;

    expect(modifiedPackages).toEqual(new Set(Object.keys(packageInfos)));
    expect(calculatedChangeTypes).toEqual({
      'pkg-1': 'minor',
      'pkg-2': 'patch',
      'pkg-3': 'patch',
      'pkg-4': 'patch',
      'pkg-5': 'patch',
    });
    expect(dependentChangedBy).toEqual({
      'pkg-2': new Set(['pkg-1']),
      'pkg-3': new Set(['pkg-2']),
      'pkg-4': new Set(['pkg-3']),
      'pkg-5': new Set(['pkg-4']),
    });

    const pkg1NewVersion = '1.1.0';
    const dependentNewVersion = '1.0.1';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(dependentNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(dependentNewVersion);
    expect(packageInfos['pkg-4'].version).toBe(dependentNewVersion);
    expect(packageInfos['pkg-5'].version).toBe(dependentNewVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(dependentNewVersion);
    expect(packageInfos['pkg-4'].peerDependencies!['pkg-3']).toBe(dependentNewVersion);
    expect(packageInfos['pkg-5'].optionalDependencies!['pkg-4']).toBe(dependentNewVersion);
  });

  it('bumps all grouped packages', () => {
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'packages/pkg-1': { version: '1.0.0' },
        'packages/pkg-2': { version: '1.0.0' },
        'packages/pkg-3': { version: '1.0.0' },
        unrelated: { version: '1.0.0' },
      },
      changes: [{ packageName: 'pkg-1', type: 'minor' }],
      repoOptions: {
        bumpDeps: true,
        groups: [{ include: 'packages/*', name: 'testgroup', disallowedChangeTypes: [] }],
      },
    });
    const { packageGroups, packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;

    expect(packageGroups).toEqual({
      testgroup: { packageNames: ['pkg-1', 'pkg-2', 'pkg-3'], disallowedChangeTypes: [] },
    });
    expect(modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2', 'pkg-3']));
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'minor', 'pkg-2': 'minor', 'pkg-3': 'minor' });
    // Not sure if this is correct?
    expect(dependentChangedBy).toEqual({});

    const newVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);
    expect(packageInfos['unrelated'].version).toBe(originalPackageInfos['unrelated'].version);
  });

  it('bumps all grouped packages to the greatest change type in the group, regardless of change file order', () => {
    const { bumpInfo } = gatherBumpInfoWrapper({
      packageFolders: {
        'packages/commonlib': { name: 'commonlib' },
        'packages/pkg-1': { version: '1.0.0', dependencies: { commonlib: '1.0.0' } },
      },
      changes: [
        { packageName: 'pkg-1', type: 'minor', dependentChangeType: 'minor' },
        // Process commonlib's change file after pkg-1's. This ensures we set the group's version
        // based on the max change type, not the last one processed (previous bug).
        { packageName: 'commonlib', type: 'none', dependentChangeType: 'none' },
      ],
      repoOptions: {
        groups: [{ include: 'packages/*', name: 'grp', disallowedChangeTypes: null }],
        bumpDeps: true,
      },
    });
    const { packageInfos } = bumpInfo;

    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['commonlib'].version).toBe('1.1.0');
  });

  it('bumps all grouped AND dependent packages', () => {
    // This is covered E2E in bump.test.ts too
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'packages/app': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'packages/commonlib': { version: '1.0.0' },
        'packages/unrelated': { version: '1.0.0' },
        'packages/grp/pkg-1': { version: '1.0.0' },
        'packages/grp/pkg-2': { version: '1.0.0' },
        'packages/grp/pkg-3': { version: '1.0.0', dependencies: { commonlib: '1.0.0' } },
      },
      repoOptions: {
        groups: [{ include: 'packages/grp/*', name: 'grp', disallowedChangeTypes: [] }],
        bumpDeps: true,
      },
      // Bump commonlib, which is not in the group, but triggers a dependent bump of pkg-3,
      // which triggers bump of the whole group and then the app.
      // Also verify the non-default dependentChangeType passes through.
      changes: [{ packageName: 'commonlib', type: 'major', dependentChangeType: 'minor' }],
    });
    const { packageGroups, packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;

    expect(packageGroups).toEqual({
      grp: { packageNames: ['pkg-1', 'pkg-2', 'pkg-3'], disallowedChangeTypes: [] },
    });
    expect(modifiedPackages).toEqual(new Set(['commonlib', 'pkg-1', 'pkg-2', 'pkg-3', 'app']));
    expect(calculatedChangeTypes).toEqual({
      commonlib: 'major',
      'pkg-1': 'minor',
      'pkg-2': 'minor',
      'pkg-3': 'minor',
      app: 'minor',
    });
    expect(dependentChangedBy).toEqual({
      'pkg-3': new Set(['commonlib']),
      app: new Set(['pkg-1']),
    });

    const groupNewVersion = '1.1.0';
    expect(packageInfos['pkg-1'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-2'].version).toBe(groupNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(groupNewVersion);
    expect(packageInfos['commonlib'].version).toBe('2.0.0');
    expect(packageInfos['app'].version).toBe('1.1.0');
    expect(packageInfos['unrelated'].version).toBe(originalPackageInfos['unrelated'].version);
  });

  // Scope filtering of original changes happens in the readChangeFiles step (so must be tested E2E),
  // but scope filtering of *dependents* happens in the bump step.
  it('should not bump out-of-scope package and its dependencies even if dependency of the package has change', () => {
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'packages/foo': { name: 'foo', version: '1.0.0', dependencies: { bar: '^1.3.4' } },
        'packages/bar': { name: 'bar', version: '1.3.4', dependencies: { baz: '^1.3.4' } },
        'packages/baz': { name: 'baz', version: '1.3.4' },
        'packages/grouped/a': { name: 'a', version: '3.1.2' },
        'packages/grouped/b': { name: 'b', version: '3.1.2' },
      },
      repoOptions: {
        bumpDeps: true,
        scope: ['!packages/foo'],
      },
      changes: [{ packageName: 'bar', type: 'patch' }],
    });
    const { scopedPackages, packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;

    expect(scopedPackages).toEqual(new Set(['a', 'b', 'bar', 'baz']));
    expect(modifiedPackages).toEqual(new Set(['bar']));
    expect(calculatedChangeTypes).toEqual({ bar: 'patch' });
    expect(dependentChangedBy).toEqual({});

    expect(packageInfos['foo']).toEqual(originalPackageInfos['foo']);
    expect(packageInfos['bar'].version).toBe('1.3.5');
    // Since foo is out of scope, currently its dep on bar is not bumped.
    // This is usually fine, but could be an issue if bar is bumped to an incompatible version.
    // Somewhat related: https://github.com/microsoft/beachball/issues/620#issuecomment-3609264966
    expect(packageInfos['foo'].dependencies!['bar']).toBe('^1.3.4');
  });

  it('bumps dependents with file: deps', () => {
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '0.0.0', dependencies: { 'pkg-1': 'file:../pkg-1' } },
        'pkg-3': { version: '0.0.0', devDependencies: { 'pkg-2': 'file:../pkg-2' } },
      },
      repoOptions: { bumpDeps: true },
      changes: [{ packageName: 'pkg-1', type: 'minor' }],
    });

    const { packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;
    expect(modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2', 'pkg-3']));
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'minor', 'pkg-2': 'patch', 'pkg-3': 'patch' });
    // Current behavior: dependentChangedBy misses file: deps, so the packages won't be in the changelog.
    // https://github.com/microsoft/beachball/issues/981
    expect(dependentChangedBy).toEqual({});

    // All the packages are bumped despite the file: dep specs.
    // The dep specs are not modified, but the dependent versions are bumped.
    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '0.0.1' });
    expect(packageInfos['pkg-3']).toEqual({ ...originalPackageInfos['pkg-3'], version: '0.0.1' });
  });

  it('bumps dependents with workspace: deps', () => {
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': { version: '1.0.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': 'workspace:~', extra: '~1.2.3' } },
        // this workspace version will be updated
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': 'workspace:^1.0.0', other: 'npm:lodash' } },
      },
      repoOptions: { bumpDeps: true },
      changes: ['pkg-1'],
    });

    const { packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;
    expect(modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2', 'pkg-3']));
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'minor', 'pkg-2': 'patch', 'pkg-3': 'patch' });
    expect(dependentChangedBy).toEqual({
      'pkg-3': new Set(['pkg-2']),
      // Current behavior: dependentChangedBy misses deps like workspace:~ that don't change,
      // so the bump of pkg-1 will be missing from pkg-2's changelog.
      // https://github.com/microsoft/beachball/issues/981
      // 'pkg-2': new Set(['pkg-1']),
    });

    // All the dependent packages are bumped despite the workspace: dep specs
    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    // workspace:~ range isn't changed
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '1.0.1' });
    // workspace: range with number is updated
    expect(packageInfos['pkg-3'].dependencies).toEqual({ 'pkg-2': 'workspace:^1.0.1', other: 'npm:lodash' });
  });

  it('bumps dependents with catalog: deps', () => {
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      // Say there's a catalog like this:
      // catalog:
      //   pkg-1: workspace:~
      //   pkg-2: workspace:^1.0.0
      packageFolders: {
        'pkg-1': { version: '1.0.0' },
        // both of these are detected as dependent bumps but currently missed from changelog
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': 'catalog:' } },
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': 'catalog:' } },
      },
      repoOptions: { bumpDeps: true },
      changes: ['pkg-1'],
    });

    const { packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;
    expect(modifiedPackages).toEqual(new Set(['pkg-1', 'pkg-2', 'pkg-3']));
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'minor', 'pkg-2': 'patch', 'pkg-3': 'patch' });
    expect(dependentChangedBy).toEqual({
      // Current behavior: dependentChangedBy misses all catalog: deps pointing to workspace: versions
      // https://github.com/microsoft/beachball/issues/981
      // 'pkg-2': new Set(['pkg-1']),
      // 'pkg-3': new Set(['pkg-2']),
    });

    // All the dependent packages are bumped despite the catalog: dep specs
    expect(packageInfos['pkg-1'].version).toBe('1.1.0');
    // catalog: ranges aren't changed
    expect(packageInfos['pkg-2']).toEqual({ ...originalPackageInfos['pkg-2'], version: '1.0.1' });
    expect(packageInfos['pkg-3']).toEqual({ ...originalPackageInfos['pkg-3'], version: '1.0.1' });
  });

  it('bumps to prerelease using prefix, and uses prerelease version for dependents', () => {
    const { bumpInfo } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': {},
        'pkg-2': { dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { peerDependencies: { 'pkg-2': '1.0.0' } },
      },
      repoOptions: {
        bumpDeps: true,
        prereleasePrefix: 'beta',
      },
      changes: [{ packageName: 'pkg-1', type: 'prerelease' }],
    });

    const { packageInfos, calculatedChangeTypes } = bumpInfo;
    // dependents are calculated as patch but later changed to prerelease
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'prerelease', 'pkg-2': 'patch', 'pkg-3': 'patch' });

    const newVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-3'].version).toBe(newVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
    expect(packageInfos['pkg-3'].peerDependencies!['pkg-2']).toBe(newVersion);
  });

  it('bumps to prerelease and uses the specified identifier base', () => {
    const { bumpInfo } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': {},
        'pkg-2': { dependencies: { 'pkg-1': '1.0.0' } },
      },
      repoOptions: {
        bumpDeps: true,
        prereleasePrefix: 'beta',
        identifierBase: '1',
      },
      changes: [{ packageName: 'pkg-1', type: 'prerelease' }],
    });

    const { packageInfos, calculatedChangeTypes } = bumpInfo;
    // dependents are calculated as patch but later changed to prerelease
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'prerelease', 'pkg-2': 'patch' });

    const newVersion = '1.0.1-beta.1';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
  });

  it('bumps to prerelease with no identifier base', () => {
    const { bumpInfo } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': {},
        'pkg-2': { dependencies: { 'pkg-1': '1.0.0' } },
      },
      repoOptions: {
        bumpDeps: true,
        prereleasePrefix: 'beta',
        identifierBase: false,
      },
      changes: [{ packageName: 'pkg-1', type: 'prerelease' }],
    });

    const { packageInfos, calculatedChangeTypes } = bumpInfo;
    // dependents are calculated as patch but later changed to prerelease
    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'prerelease', 'pkg-2': 'patch' });

    const newVersion = '1.0.1-beta';
    expect(packageInfos['pkg-1'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].version).toBe(newVersion);
    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(newVersion);
  });

  it('bumps all packages and increments prefixed versions in dependents', () => {
    const { bumpInfo } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': { version: '1.0.1-beta.0' },
        'pkg-2': { version: '1.0.0', dependencies: { 'pkg-1': '1.0.0' } },
        'pkg-3': { version: '1.0.0', devDependencies: { 'pkg-2': '1.0.0' } },
      },
      repoOptions: {
        bumpDeps: true,
        prereleasePrefix: 'beta',
      },
      changes: [{ packageName: 'pkg-1', type: 'prerelease', dependentChangeType: 'prerelease' }],
    });
    const { packageInfos, calculatedChangeTypes } = bumpInfo;

    expect(calculatedChangeTypes).toEqual({ 'pkg-1': 'prerelease', 'pkg-2': 'prerelease', 'pkg-3': 'prerelease' });

    const pkg1NewVersion = '1.0.1-beta.1';
    const othersNewVersion = '1.0.1-beta.0';
    expect(packageInfos['pkg-1'].version).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-2'].version).toBe(othersNewVersion);
    expect(packageInfos['pkg-3'].version).toBe(othersNewVersion);

    expect(packageInfos['pkg-2'].dependencies!['pkg-1']).toBe(pkg1NewVersion);
    expect(packageInfos['pkg-3'].devDependencies!['pkg-2']).toBe(othersNewVersion);
  });

  it('does not modify dependency ranges of packages that are not bumped', () => {
    // This was probably the scenario from https://github.com/microsoft/beachball/issues/1033
    const { bumpInfo, originalPackageInfos } = gatherBumpInfoWrapper({
      packageFolders: {
        'pkg-1': { version: '1.0.0' },
        // pkg-2 was bumped to 1.2.3 at some point (with a manual or scoped bump)
        'pkg-2': { version: '1.2.3', dependencies: { 'pkg-1': '^1.0.0' } },
        // but pkg-3's range of pkg-2 was not updated (though it's still satisfied)
        'pkg-3': { version: '1.0.0', dependencies: { 'pkg-2': '^1.0.0' } },
      },
      repoOptions: { bumpDeps: true },
      changes: ['pkg-3'],
    });
    const { packageInfos, modifiedPackages, calculatedChangeTypes, dependentChangedBy } = bumpInfo;

    expect(modifiedPackages).toEqual(new Set(['pkg-3']));
    expect(calculatedChangeTypes).toEqual({ 'pkg-3': 'minor' });
    expect(dependentChangedBy).toEqual({});

    // pkg-3's deps weren't modified because pkg-2 wasn't bumped
    expect(packageInfos['pkg-3'].dependencies).toEqual(originalPackageInfos['pkg-3'].dependencies);
  });
});
