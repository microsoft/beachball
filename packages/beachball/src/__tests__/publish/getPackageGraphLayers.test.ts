import { describe, expect, it } from '@jest/globals';
import { initMockLogs } from '../../__fixtures__/mockLogs';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { getPackageGraphLayers } from '../../publish/getPackageGraphLayers';

describe('getPackageGraphLayers', () => {
  const logs = initMockLogs();

  /**
   * Call `getPackageGraphLayers` and sort each layer for easier testing (order within layer doesn't matter).
   */
  function getPackageGraphLayersWrapper(packagesToPublish: string[], packageInfos: PartialPackageInfos): string[][] {
    return getPackageGraphLayers(packagesToPublish, makePackageInfos(packageInfos)).map(layer => layer.sort());
  }

  it('returns empty for no packages to publish', () => {
    const result = getPackageGraphLayersWrapper([], { foo: {}, bar: {} });
    expect(result).toEqual([]);
  });

  it('returns single layer for one package with no deps', () => {
    const result = getPackageGraphLayersWrapper(['foo'], { foo: {} });
    expect(result).toEqual([['foo']]);
  });

  it('puts independent packages in the same layer', () => {
    const result = getPackageGraphLayersWrapper(['foo', 'bar', 'baz'], { foo: {}, bar: {}, baz: {} });
    expect(result).toEqual([['bar', 'baz', 'foo']]);
  });

  it('puts packages in layers based on linear dependency chain', () => {
    const result = getPackageGraphLayersWrapper(['a', 'b', 'c'], {
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { c: '1.0.0' } },
      c: {},
    });
    expect(result).toEqual([['c'], ['b'], ['a']]);
  });

  it('handles diamond dependency', () => {
    const result = getPackageGraphLayersWrapper(['a', 'b', 'c', 'd'], {
      a: { dependencies: { b: '1.0.0', c: '1.0.0' } },
      b: { dependencies: { d: '1.0.0' } },
      c: { dependencies: { d: '1.0.0' } },
      d: {},
    });
    expect(result).toEqual([['d'], ['b', 'c'], ['a']]);
  });

  it('considers dependencies, optionalDependencies, and peerDependencies', () => {
    const result = getPackageGraphLayersWrapper(['a', 'b', 'c', 'd'], {
      a: { peerDependencies: { d: '1.0.0' } },
      b: { optionalDependencies: { d: '1.0.0' } },
      c: { dependencies: { d: '1.0.0' } },
      d: {},
    });
    expect(result).toEqual([['d'], ['a', 'b', 'c']]);
  });

  it('ignores devDependencies', () => {
    const result = getPackageGraphLayersWrapper(['a', 'b'], {
      a: { devDependencies: { b: '1.0.0' } },
      b: {},
    });
    // a's devDep on b should be ignored, so both are in the same layer
    expect(result).toEqual([['a', 'b']]);
  });

  // This is a probably-impossible case, but documenting the behavior (it should never happen
  // because for "b" to be missing, bumpDeps would need to be false, which would trigger the
  // logic to fall back to all packages)
  it('ignores deps outside packagesToPublish', () => {
    const result = getPackageGraphLayersWrapper(['a', 'c'], {
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { c: '1.0.0' } },
      c: {},
    });

    // These end up in the same layer because "b" is not considered
    expect(result).toEqual([['a', 'c']]);
  });

  it('ignores dependencies on packages outside packageInfos', () => {
    const result = getPackageGraphLayersWrapper(['a', 'b'], {
      a: { dependencies: { 'external-pkg': '1.0.0' } },
      b: {},
    });
    expect(result).toEqual([['a', 'b']]);
  });

  it('handles cycles by grouping cyclic packages in a final layer', () => {
    const result = getPackageGraphLayersWrapper(['a', 'b', 'c'], {
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { a: '1.0.0' } },
      c: {},
    });
    expect(result).toEqual([['c'], ['a', 'b']]);

    expect(logs.getMockLines('warn')).toMatchInlineSnapshot(`
      "Circular dependencies detected among the following packages:
        • a
        • b
      If these packages have any interdependencies, publishing order MAY BE INCORRECT."
    `);
  });

  it('handles cycle with non-cyclic dependents', () => {
    // d depends on a, and a<->b form a cycle; c is independent
    const result = getPackageGraphLayersWrapper(['a', 'b', 'c', 'd'], {
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { a: '1.0.0' } },
      c: {},
      d: { dependencies: { a: '1.0.0', c: '1.0.0' } },
    });
    // c is layer 0; a, b, and d are all stuck (d can't be placed until a is, but a is cyclic)
    // so they all end up in the final cycle-remainder layer
    expect(result).toEqual([['c'], ['a', 'b', 'd']]);

    expect(logs.getMockLines('warn')).toMatchInlineSnapshot(`
      "Circular dependencies detected among the following packages:
        • a
        • b
        • d
      If these packages have any interdependencies, publishing order MAY BE INCORRECT."
    `);
  });
});
