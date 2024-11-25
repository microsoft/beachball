import { describe, expect, it } from '@jest/globals';
import { toposortPackages } from '../../publish/toposortPackages';
import { PackageInfos } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('toposortPackages', () => {
  it('sort packages which none of them has dependency', () => {
    const packageInfos: PackageInfos = makePackageInfos({ foo: {}, bar: {} });

    expect(toposortPackages(['foo', 'bar'], packageInfos)).toEqual(['foo', 'bar']);
  });

  it('sort packages with dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: {
        dependencies: { foo3: '1.0.0', bar2: '1.0.0' },
      },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo2: {},
    });

    expect(toposortPackages(['foo', 'foo2', 'foo3'], packageInfos)).toEqual(['foo2', 'foo3', 'foo']);
  });

  it('sort packages with different kinds of dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: {} },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: { devDependencies: { foo2: '1.0.0' } },
    });

    expect(toposortPackages(['foo', 'foo2', 'foo3', 'foo4'], packageInfos)).toEqual(['foo2', 'foo3', 'foo4', 'foo']);
  });

  it('do not sort packages if it is not included', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    expect(toposortPackages(['foo', 'foo3'], packageInfos)).toEqual(['foo3', 'foo']);
  });

  it('throws if contains circular dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0', bar2: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    expect(() => {
      toposortPackages(['foo', 'bar'], packageInfos);
    }).toThrow(/Cyclic dependency.*?foo/);
  });

  it('throws if package info is missing', () => {
    const packageInfos = {} as PackageInfos;

    expect(() => {
      toposortPackages(['foo'], packageInfos);
    }).toThrow('Package info is missing for foo.');
  });
});
