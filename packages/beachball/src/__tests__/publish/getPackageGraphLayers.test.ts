import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { generateChangeSet } from '../../__fixtures__/changeFiles';
import { makePackageInfos, type PartialPackageInfos } from '../../__fixtures__/packageInfos';
import { getPackageGraphLayers } from '../../publish/getPackageGraphLayers';
import type { BeachballOptions } from '../../types/BeachballOptions';
import { getPackageDependencies } from 'workspace-tools';
import { initMockLogs } from '../../__fixtures__/mockLogs';

jest.mock('workspace-tools', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const wstools = jest.requireActual<typeof import('workspace-tools')>('workspace-tools');
  return { ...wstools, getPackageDependencies: jest.fn(wstools.getPackageDependencies) };
});

describe('getPackageGraphLayers', () => {
  const logs = initMockLogs();
  const getPackageDependenciesSpy = getPackageDependencies as jest.MockedFunction<typeof getPackageDependencies>;
  const anything = expect.anything();

  afterEach(() => {
    getPackageDependenciesSpy.mockClear();
  });

  /**
   * Call `getPackageGraphLayers` and sort each layer for easier testing (order within layer doesn't matter).
   *
   * `changeSet` defaults to including all of `packagesToPublish`.
   * Option defaults are the same as from `getDefaultOptions`.
   */
  function getPackageGraphLayersWrapper(params: {
    packageInfos: PartialPackageInfos;
    changeSet?: Parameters<typeof generateChangeSet>[0];
    packagesToPublish: string[];
    newPackages?: string[];
    options?: Partial<Pick<BeachballOptions, 'bumpDeps' | 'scope'>>;
  }): string[][] {
    const { packageInfos, changeSet, packagesToPublish, newPackages, options = {} } = params;

    return getPackageGraphLayers({
      packagesToPublish,
      options: { bumpDeps: true, scope: null, ...options },
      bumpInfo: {
        packageInfos: makePackageInfos(packageInfos),
        changeFileChangeInfos: generateChangeSet(changeSet || packagesToPublish),
        newPackages,
      },
    }).map(layer => layer.sort());
  }

  it('returns empty for no packages to publish', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: { foo: {}, bar: {} },
      packagesToPublish: [],
    });
    expect(result).toEqual([]);
  });

  it('returns single layer for one package with no deps', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: { foo: {} },
      packagesToPublish: ['foo'],
    });
    expect(result).toEqual([['foo']]);
  });

  it('puts independent packages in the same layer', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: { foo: {}, bar: {}, baz: {} },
      packagesToPublish: ['foo', 'bar', 'baz'],
    });
    expect(result).toEqual([['bar', 'baz', 'foo']]);
  });

  it('puts packages in layers based on linear dependency chain', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { dependencies: { b: '1.0.0' } },
        b: { dependencies: { c: '1.0.0' } },
        c: {},
      },
      packagesToPublish: ['a', 'b', 'c'],
    });
    expect(result).toEqual([['c'], ['b'], ['a']]);

    // Verify this works for later tests
    expect(getPackageDependencies).toHaveBeenLastCalledWith(anything, new Set(['a', 'b', 'c']), anything);
  });

  it('handles diamond dependency', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { dependencies: { b: '1.0.0', c: '1.0.0' } },
        b: { dependencies: { d: '1.0.0' } },
        c: { dependencies: { d: '1.0.0' } },
        d: {},
      },
      packagesToPublish: ['a', 'b', 'c', 'd'],
    });
    expect(result).toEqual([['d'], ['b', 'c'], ['a']]);
  });

  it('considers dependencies, optionalDependencies, and peerDependencies', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { peerDependencies: { d: '1.0.0' } },
        b: { optionalDependencies: { d: '1.0.0' } },
        c: { dependencies: { d: '1.0.0' } },
        d: {},
      },
      packagesToPublish: ['a', 'b', 'c', 'd'],
    });
    expect(result).toEqual([['d'], ['a', 'b', 'c']]);
  });

  it('ignores devDependencies', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { devDependencies: { b: '1.0.0' } },
        b: {},
      },
      packagesToPublish: ['a', 'b'],
    });
    // a's devDep on b should be ignored, so both are in the same layer
    expect(result).toEqual([['a', 'b']]);
  });

  it.each<[string, Partial<Parameters<typeof getPackageGraphLayersWrapper>[0]>]>([
    ['bumpDeps: false', { options: { bumpDeps: false } }],
    // Doesn't matter if the scope includes everything; we conservatively fall back with any scope
    ['scope', { options: { scope: ['**/*'] } }],
    ['newPackages', { newPackages: ['a'], changeSet: ['c'] }],
    ['dependentChangeType "none"', { changeSet: [{ packageName: 'a', dependentChangeType: 'none' }, 'c'] }],
  ])('with %s, separates layers through unpublished intermediate packages', (_, params) => {
    // Graph: app -> utils -> core -> base, with lib -> core as well
    // Only app, core, and lib are published (utils and base are not)
    // base is layer 0, core is layer 2 (through base), utils is layer 3, app is layer 4, lib is layer 3
    const packageInfos = {
      app: { dependencies: { utils: '1.0.0' } },
      utils: { dependencies: { core: '1.0.0' } },
      core: { dependencies: { base: '1.0.0' } },
      base: {},
      lib: { dependencies: { core: '1.0.0' } },
    };
    const result = getPackageGraphLayersWrapper({
      packageInfos,
      packagesToPublish: ['app', 'core', 'lib'],
      options: { bumpDeps: false },
      ...params,
    });

    // All the packages in the repo are considered in the calculation
    expect(getPackageDependencies).toHaveBeenLastCalledWith(anything, new Set(Object.keys(packageInfos)), anything);

    // core depends on base (layer 0 -> layer 1 for core)
    // lib depends on core directly (layer 2)
    // app depends on utils (layer 2) which depends on core (layer 1), so app is layer 3
    // After filtering: [[core], [lib], [app]] — lib and app end up in separate layers
    // because utils (unpublished) sits between app and core
    expect(result).toEqual([['core'], ['lib'], ['app']]);
  });

  // This is a probably-impossible case, but documenting the behavior (it should never happen
  // because for "b" to be missing, bumpDeps would need to be false, which would trigger the
  // logic to fall back to all packages)
  it('with default options, ignores deps outside packagesToPublish', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { dependencies: { b: '1.0.0' } },
        b: { dependencies: { c: '1.0.0' } },
        c: {},
      },
      packagesToPublish: ['a', 'c'],
    });

    expect(getPackageDependencies).toHaveBeenLastCalledWith(anything, new Set(['a', 'c']), anything);

    // These end up in the same layer because "b" is not considered
    expect(result).toEqual([['a', 'c']]);
  });

  it('ignores dependencies on packages outside packageInfos', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { dependencies: { 'external-pkg': '1.0.0' } },
        b: {},
      },
      packagesToPublish: ['a', 'b'],
    });
    expect(result).toEqual([['a', 'b']]);
  });

  it('handles cycles by grouping cyclic packages in a final layer', () => {
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { dependencies: { b: '1.0.0' } },
        b: { dependencies: { a: '1.0.0' } },
        c: {},
      },
      packagesToPublish: ['a', 'b', 'c'],
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
    const result = getPackageGraphLayersWrapper({
      packageInfos: {
        a: { dependencies: { b: '1.0.0' } },
        b: { dependencies: { a: '1.0.0' } },
        c: {},
        d: { dependencies: { a: '1.0.0', c: '1.0.0' } },
      },
      packagesToPublish: ['a', 'b', 'c', 'd'],
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
