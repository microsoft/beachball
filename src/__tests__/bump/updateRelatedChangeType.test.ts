import { describe, expect, it } from '@jest/globals';
import { updateRelatedChangeType } from '../../bump/updateRelatedChangeType';
import type { ChangeFileInfo, ChangeInfo, ChangeType } from '../../types/ChangeInfo';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import type { PackageGroups } from '../../types/PackageInfo';
import { getDependentsForPackages } from '../../bump/getDependentsForPackages';
import type { BeachballOptions } from '../../types/BeachballOptions';

type RelatedChangeTypeParams = Omit<Parameters<typeof updateRelatedChangeType>[0], 'change'>;

describe('updateRelatedChangeType', () => {
  /**
   * Call `updateRelatedChangeType` once for each of `changes`.
   * Returns the updated bump info.
   */
  function callUpdateRelatedChangeType(
    options: Partial<Pick<BeachballOptions, 'bumpDeps'>> & {
      changes: Array<Pick<ChangeInfo, 'packageName' | 'type' | 'dependentChangeType'>>;
      /**
       * All the packages used in this fixture, including any per-package beachball options.
       * Must include any dependencies (all versions are 1.0.0).
       */
      packages: PartialPackageInfos;
      /** Repo disallowed change types */
      options?: Pick<BeachballOptions, 'disallowedChangeTypes'>;
      /**
       * Initial calculated change types before updates. This is **required** if `packageGroups`
       * is specified (since the initial calculation is complex) but otherwise a default can be
       * calculated from `changes`.
       */
      calculatedChangeTypes?: { [packageName: string]: ChangeType };
      packageGroups?: PackageGroups;
    }
  ) {
    const { packages, packageGroups, bumpDeps = true } = options;

    if (packageGroups && !options.calculatedChangeTypes) {
      throw new Error('calculatedChangeTypes must be specified if packageGroups is used');
    }

    const changes: ChangeFileInfo[] = options.changes.map(change => ({
      ...change,
      comment: 'test comment',
      commit: '0xdeadbeef',
      email: 'test@dev.com',
    }));

    const packageInfos = makePackageInfos(packages);

    const params: RelatedChangeTypeParams = {
      bumpInfo: {
        calculatedChangeTypes:
          options.calculatedChangeTypes || Object.fromEntries(changes.map(change => [change.packageName, change.type])),
        packageInfos,
        packageGroups: packageGroups || {},
      },
      options: { disallowedChangeTypes: null, ...options.options },
      // Dependents are confusing to reason about directly (or specify in fixtures) since they're
      // backwards from dependencies, so just reuse the actual helper that calculates them
      dependents: bumpDeps
        ? getDependentsForPackages({ packageInfos, scopedPackages: new Set(Object.keys(packageInfos)) })
        : undefined,
    };

    for (const change of changes) {
      updateRelatedChangeType({ change, ...params });
    }

    return params.bumpInfo;
  }

  it('should bump dependent packages according to the dependentChangeTypes', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      changes: [{ packageName: 'foo', type: 'patch', dependentChangeType: 'minor' }],
      packages: {
        bar: { dependencies: { foo: '1.0.0' } },
        foo: {},
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'patch',
      bar: 'minor',
    });
  });

  it('does not bump dependents with bumpDeps: false', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      bumpDeps: false,
      changes: [{ packageName: 'foo', type: 'patch', dependentChangeType: 'minor' }],
      packages: {
        bar: { dependencies: { foo: '1.0.0' } },
        foo: {},
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({ foo: 'patch' });
  });

  it("respects bumped dependent package's own change type if higher than dependentChangeType", () => {
    const bumpInfo = callUpdateRelatedChangeType({
      changes: [
        // bar depends on foo, so it would be bumped with patch from there,
        // but its own change type major takes precedence
        { packageName: 'bar', type: 'major', dependentChangeType: 'minor' },
        { packageName: 'foo', type: 'patch', dependentChangeType: 'patch' },
      ],
      packages: {
        app: { dependencies: { bar: '1.0.0' } },
        bar: { dependencies: { foo: '1.0.0' } },
        foo: {},
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'patch',
      bar: 'major',
      app: 'minor',
    });
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and dependentChangeInfos must stay up to date', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      changes: [
        // Initially bump foo dependents as patch, then bump them again as minor
        { packageName: 'foo', type: 'patch', dependentChangeType: 'patch' },
        { packageName: 'foo', type: 'patch', dependentChangeType: 'minor' },
      ],
      // Suppose there was some other change file for baz that was already procesessed
      calculatedChangeTypes: { foo: 'patch', baz: 'minor' },
      packages: {
        app: { dependencies: { bar: '1.0.0' } },
        bar: { dependencies: { foo: '1.0.0', baz: '2.0.0' } },
        baz: {},
        foo: {},
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'patch',
      baz: 'minor',
      bar: 'minor',
      app: 'minor', // this propagates all the way up from foo
    });
  });

  it('should bump dependent packages according to the bumpInfo.dependentChangeTypes and roll-up multiple change infos', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      changes: [
        { packageName: 'foo', type: 'patch', dependentChangeType: 'major' },
        { packageName: 'foo', type: 'patch', dependentChangeType: 'minor' },
      ],
      packages: {
        app: { dependencies: { bar: '1.0.0', baz: '2.0.0' } },
        bar: { dependencies: { foo: '1.0.0', baz: '2.0.0' } },
        baz: {},
        foo: {},
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'patch',
      bar: 'major',
      app: 'major',
    });
  });

  // bumpInPlace sets calculatedChangeTypes for all packages in a group to the same type.
  // So the meaningful thing to test is that a bump of a dependency *outside* the group
  // propagates in to bump the group.
  it('bumps all grouped packages, if a dependency was bumped', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      packageGroups: { grp: { packageNames: ['foo', 'bar'], disallowedChangeTypes: null } },
      // Suppose there was some additional change file that already patch bumped the group packages
      calculatedChangeTypes: { foo: 'patch', bar: 'patch', dep: 'major' },
      // Bumping this dep of the group should bump the group
      changes: [{ packageName: 'dep', type: 'major', dependentChangeType: 'minor' }],
      packages: {
        foo: { dependencies: { dep: '1.0.0' } },
        bar: {},
        dep: {},
        unrelated: {},
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'minor',
      bar: 'minor',
      dep: 'major',
    });
  });

  it('should bump dependent package, if a dependency was in a group', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      packages: {
        foo: {},
        bar: { dependencies: { dep: '1.0.0' } },
        dep: {},
        app: { dependencies: { foo: '1.0.0' } },
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'], disallowedChangeTypes: null } },
      calculatedChangeTypes: { dep: 'patch' },
      changes: [{ packageName: 'dep', type: 'patch', dependentChangeType: 'minor' }],
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'minor',
      bar: 'minor',
      app: 'minor',
      dep: 'patch',
    });
  });

  it('should propagate dependent change type across group', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      packages: {
        styling: { dependencies: { mergeStyles: '1.0.0' } },
        utils: {},
        mergeStyles: {},
        foo: {},
        bar: { dependencies: { styling: '1.0.0', utils: '1.0.0' } },
        datetime: { dependencies: { bar: '1.0.0', datetimeUtils: '1.0.0' } },
        datetimeUtils: {},
      },
      packageGroups: { grp: { packageNames: ['foo', 'bar'], disallowedChangeTypes: null } },
      changes: [
        { packageName: 'mergeStyles', type: 'patch', dependentChangeType: 'minor' },
        { packageName: 'datetimeUtils', type: 'patch', dependentChangeType: 'patch' },
      ],
      calculatedChangeTypes: { mergeStyles: 'patch', datetimeUtils: 'patch' },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      foo: 'minor',
      bar: 'minor',
      datetime: 'minor',
      styling: 'minor',
      mergeStyles: 'patch',
      datetimeUtils: 'patch',
    });
  });

  it('respects repo disallowed change type', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      changes: [{ packageName: 'bar', type: 'major', dependentChangeType: 'minor' }],
      packages: {
        bar: {},
        foo: { dependencies: { bar: '1.0.0' } },
      },
      options: { disallowedChangeTypes: ['major', 'minor'] },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      bar: 'major',
      // This points out an interesting artifact of the new pre* support that should probably be
      // better rationalized... (prior to that change, this would have been 'patch', which is
      // more likely the expected behavior in general)
      // https://github.com/microsoft/beachball/issues/947
      foo: 'preminor',
    });
  });

  it('respects package disallowed change type', () => {
    const bumpInfo = callUpdateRelatedChangeType({
      changes: [{ packageName: 'bar', type: 'major', dependentChangeType: 'minor' }],
      packages: {
        bar: {},
        foo: {
          dependencies: { bar: '1.0.0' },
          beachball: { disallowedChangeTypes: ['minor', 'major'] },
        },
      },
    });

    expect(bumpInfo.calculatedChangeTypes).toEqual({
      bar: 'major',
      // This points out an interesting artifact of the new pre* support that should probably be
      // better rationalized... (prior to that change, this would have been 'patch', which is
      // more likely the expected behavior in general)
      // https://github.com/microsoft/beachball/issues/947
      foo: 'preminor',
    });
  });
});
