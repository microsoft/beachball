import { describe, expect, it } from '@jest/globals';
import { setDependentVersions } from '../../bump/setDependentVersions';
import { BeachballOptions } from '../../types/BeachballOptions';
import { PackageInfos } from '../../types/PackageInfo';

describe("dependent packages are part of the bump", () => {
  it("adds dependents for new changelog entries", () => {
    const packageInfos: PackageInfos = {
      foo: {
        combinedOptions: {} as any,
        name: 'foo',
        packageJsonPath: 'packages/foo/package.json',
        packageOptions: {},
        private: false,
        version: '1.0.0',
        dependencies: {
          bar: '*',
        },
      },
      bar: {
        combinedOptions: {} as any,
        name: 'bar',
        packageJsonPath: 'packages/bar/package.json',
        packageOptions: {},
        private: false,
        version: '1.0.0',
      },
    };

    const scopedPackages = new Set(['foo', 'bar']);

    const dependentChangedBy = setDependentVersions(
      packageInfos,
      scopedPackages,
      { verbose: false } as BeachballOptions
    );

    expect(dependentChangedBy['foo']).toBeTruthy();
    expect(dependentChangedBy['foo'].size).toBe(1);

  })
})