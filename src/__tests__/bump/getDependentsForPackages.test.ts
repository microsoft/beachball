import { describe, it, expect } from '@jest/globals';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { consideredDependencies } from '../../types/PackageInfo';
import { getDependentsForPackages } from '../../bump/getDependentsForPackages';

describe('getDependentsForPackages', () => {
  it.each(consideredDependencies)('includes %s', depType => {
    const packages = makePackageInfos({
      foo: { [depType]: { baz: '1.0.0' } },
      bar: { [depType]: { baz: '1.0.0' } },
      baz: {},
    });
    const dependents = getDependentsForPackages({
      packageInfos: packages,
      scopedPackages: new Set(Object.keys(packages)),
    });
    expect(dependents).toEqual({
      baz: ['foo', 'bar'],
    });
  });

  it('does not include transitive dependencies', () => {
    const packages = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { baz: '1.0.0' } },
      baz: {},
    });
    const dependents = getDependentsForPackages({
      packageInfos: packages,
      scopedPackages: new Set(Object.keys(packages)),
    });
    expect(dependents).toEqual({
      bar: ['foo'],
      baz: ['bar'],
    });
  });

  it('only includes dependencies of in-scope packages', () => {
    const packages = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { baz: '1.0.0' } },
      baz: {},
    });
    const dependents = getDependentsForPackages({
      packageInfos: packages,
      // means only look at dependencies of foo
      scopedPackages: new Set(['foo']),
    });
    expect(dependents).toEqual({
      bar: ['foo'],
    });
  });
});
