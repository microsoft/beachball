import { describe, expect, it } from '@jest/globals';
import { getPancakes } from '../../publish/getPancakes';
import { makePackageInfos } from '../../__fixtures__/packageInfos';

describe('getPancakes', () => {
  /**
   * Call `getPancakes` and sort each layer for easier testing (order within layer doesn't matter)
   */
  function getSortedPancakes(params: Parameters<typeof getPancakes>[0]): string[][] {
    return getPancakes(params).map(layer => layer.sort());
  }

  it('returns empty for no packages to publish', () => {
    const packageInfos = makePackageInfos({ foo: {}, bar: {} });
    expect(getPancakes({ packagesToPublish: [], packageInfos })).toEqual([]);
  });

  it('returns single layer for one package with no deps', () => {
    const packageInfos = makePackageInfos({ foo: {} });
    expect(getPancakes({ packagesToPublish: ['foo'], packageInfos })).toEqual([['foo']]);
  });

  it('puts independent packages in the same layer', () => {
    const packageInfos = makePackageInfos({ foo: {}, bar: {}, baz: {} });
    const result = getSortedPancakes({ packagesToPublish: ['foo', 'bar', 'baz'], packageInfos });
    expect(result).toEqual([['bar', 'baz', 'foo']]);
  });

  it('puts packages in layers based on linear dependency chain', () => {
    const packageInfos = makePackageInfos({
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { c: '1.0.0' } },
      c: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b', 'c'], packageInfos });
    expect(result).toEqual([['c'], ['b'], ['a']]);
  });

  it('handles diamond dependency', () => {
    const packageInfos = makePackageInfos({
      a: { dependencies: { b: '1.0.0', c: '1.0.0' } },
      b: { dependencies: { d: '1.0.0' } },
      c: { dependencies: { d: '1.0.0' } },
      d: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b', 'c', 'd'], packageInfos });
    expect(result).toEqual([['d'], ['b', 'c'], ['a']]);
  });

  it('considers dependencies, optionalDependencies, and peerDependencies', () => {
    const packageInfos = makePackageInfos({
      a: { peerDependencies: { d: '1.0.0' } },
      b: { optionalDependencies: { d: '1.0.0' } },
      c: { dependencies: { d: '1.0.0' } },
      d: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b', 'c', 'd'], packageInfos });
    expect(result).toEqual([['d'], ['a', 'b', 'c']]);
  });

  it('ignores devDependencies', () => {
    const packageInfos = makePackageInfos({
      a: { devDependencies: { b: '1.0.0' } },
      b: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b'], packageInfos });
    // a's devDep on b should be ignored, so both are in the same layer
    expect(result).toEqual([['a', 'b']]);
  });

  it('accounts for deps outside packagesToPublish but in packageInfos', () => {
    // a -> b -> c, but only a and c are being published
    // a should still be in a later layer than c because of transitive dep through b
    const packageInfos = makePackageInfos({
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { c: '1.0.0' } },
      c: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'c'], packageInfos });
    expect(result).toEqual([['c'], ['a']]);
  });

  it('ignores dependencies on packages outside packageInfos', () => {
    const packageInfos = makePackageInfos({
      a: { dependencies: { 'external-pkg': '1.0.0' } },
      b: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b'], packageInfos });
    expect(result).toEqual([['a', 'b']]);
  });

  it('separates layers through unpublished intermediate packages', () => {
    // Graph: app -> utils -> core -> base, with lib -> core as well
    // Only app, core, and lib are published (utils and base are not)
    // base is layer 0, core is layer 2 (through base), utils is layer 3, app is layer 4, lib is layer 3
    const packageInfos = makePackageInfos({
      app: { dependencies: { utils: '1.0.0' } },
      utils: { dependencies: { core: '1.0.0' } },
      core: { dependencies: { base: '1.0.0' } },
      base: {},
      lib: { dependencies: { core: '1.0.0' } },
    });
    const result = getSortedPancakes({ packagesToPublish: ['app', 'core', 'lib'], packageInfos });
    // core depends on base (layer 0 -> layer 1 for core)
    // lib depends on core directly (layer 2)
    // app depends on utils (layer 2) which depends on core (layer 1), so app is layer 3
    // After filtering: [[core], [lib], [app]] — lib and app end up in separate layers
    // because utils (unpublished) sits between app and core
    expect(result).toEqual([['core'], ['lib'], ['app']]);
  });

  it('handles cycles by grouping cyclic packages in a final layer', () => {
    const packageInfos = makePackageInfos({
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { a: '1.0.0' } },
      c: {},
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b', 'c'], packageInfos });
    expect(result).toEqual([['c'], ['a', 'b']]);
  });

  it('handles cycle with non-cyclic dependents', () => {
    // d depends on a, and a<->b form a cycle; c is independent
    const packageInfos = makePackageInfos({
      a: { dependencies: { b: '1.0.0' } },
      b: { dependencies: { a: '1.0.0' } },
      c: {},
      d: { dependencies: { a: '1.0.0', c: '1.0.0' } },
    });
    const result = getSortedPancakes({ packagesToPublish: ['a', 'b', 'c', 'd'], packageInfos });
    // c is layer 0; a, b, and d are all stuck (d can't be placed until a is, but a is cyclic)
    // so they all end up in the final cycle-remainder layer
    expect(result).toEqual([['c'], ['a', 'b', 'd']]);
  });
});
