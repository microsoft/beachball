import { describe, expect, it } from '@jest/globals';
import type { PGraph } from 'p-graph';
import type { PackageInfos } from '../../types/PackageInfo';
import { makePackageInfos } from '../../__fixtures__/packageInfos';
import { _getPackageDependencyGraph, getPackageGraph } from '../../monorepo/getPackageGraph';

// These tests cover the helper to get the edges.
describe('_getPackageDependencyGraph', () => {
  function getPackageDependencyGraphWrapper(packages: string[], packageInfos: PackageInfos): [string, string][] {
    // sort alphabetically
    return _getPackageDependencyGraph(packages, packageInfos).sort(([depA, dependentA], [depB, dependentB]) => {
      return depA === depB
        ? (dependentA ?? '').localeCompare(dependentB ?? '')
        : (depA ?? '').localeCompare(depB ?? '');
    });
  }

  it('returns empty if no dependencies', () => {
    const packageInfos: PackageInfos = makePackageInfos({ foo: {}, bar: {} });

    const result = getPackageDependencyGraphWrapper(['foo', 'bar'], packageInfos);
    expect(result).toEqual([]);
  });

  it.each(['dependencies', 'peerDependencies', 'optionalDependencies'] as const)(
    'includes edges for %s',
    dependencyType => {
      const packageInfos = makePackageInfos({
        foo: { [dependencyType]: { foo3: '1.0.0' } },
        foo2: {},
        foo3: { dependencies: { foo2: '1.0.0' } },
      });

      const result = getPackageDependencyGraphWrapper(['foo', 'foo2', 'foo3'], packageInfos);
      expect(result).toEqual([
        ['foo2', 'foo3'],
        ['foo3', 'foo'],
      ]);
    }
  );

  it('ignores devDependencies', () => {
    const packageInfos = makePackageInfos({
      foo: { devDependencies: { foo3: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    const result = getPackageDependencyGraphWrapper(['foo', 'foo2', 'foo3'], packageInfos);
    expect(result).toEqual([['foo2', 'foo3']]);
  });

  it('ignores external dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: {
        dependencies: { foo3: '1.0.0', bar2: '1.0.0' },
      },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo2: {},
    });

    const result = getPackageDependencyGraphWrapper(['foo', 'foo2', 'foo3'], packageInfos);
    expect(result).toEqual([
      ['foo2', 'foo3'],
      ['foo3', 'foo'],
    ]);
  });

  it('creates edges for mixed kinds of dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: {},
    });

    const result = getPackageDependencyGraphWrapper(['foo', 'foo2', 'foo3', 'foo4'], packageInfos);
    expect(result).toEqual([
      ['foo2', 'foo3'],
      ['foo3', 'foo'],
      ['foo4', 'foo'],
    ]);
  });

  it('ignores packages if not included', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    const result = getPackageDependencyGraphWrapper(['foo', 'foo3'], packageInfos);
    expect(result).toEqual([['foo3', 'foo']]);
  });

  it('ignores packages if not included (harder scenario)', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: { foo4: '1.0.0' } },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: {},
      bar: { dependencies: { foo: '1.0.0' } },
    });

    const result = getPackageDependencyGraphWrapper(['foo', 'foo3'], packageInfos);
    expect(result).toEqual([['foo3', 'foo']]);
  });

  // not this function's job to check for circular deps
  it('does not check for circular dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    const result = getPackageDependencyGraphWrapper(['foo', 'bar'], packageInfos);
    expect(result).toEqual([
      ['bar', 'foo'],
      ['foo', 'bar'],
    ]);
  });

  it('throws if package info is missing', () => {
    expect(() => getPackageDependencyGraphWrapper(['foo', 'bar'], {})).toThrow(`Package info is missing for foo.`);
  });
});

describe('getPackageGraph', () => {
  /**
   * Run the PGraph returned by `getPackageGraph`, and return the package names in the order that
   * they were visited.
   */
  async function getPackageGraphOrder(packageGraph: PGraph): Promise<string[]> {
    const visitedPackages: string[] = [];
    await packageGraph.run({
      concurrency: 1,
      run: pkgName => {
        visitedPackages.push(pkgName);
      },
    });
    return visitedPackages;
  }

  /**
   * Validate that both running the graph and getting its layers return a valid ordering of packages.
   * (Less relevant now that both are handled within PGraph, but doesn't hurt.)
   */
  async function validateOrdering(
    inputPackages: string[],
    packageInfos: PackageInfos,
    possibleSolutions: string[][]
  ): Promise<void> {
    const packageGraph = getPackageGraph(inputPackages, packageInfos);
    const packageGraphResult = await getPackageGraphOrder(packageGraph);
    expect(possibleSolutions).toContainEqual(packageGraphResult);

    const packageLayersResult = packageGraph.getLayers().flat();
    expect(possibleSolutions).toContainEqual(packageLayersResult);
  }

  it('returns an empty graph if no packages are affected', async () => {
    const packageInfos: PackageInfos = makePackageInfos({});
    await validateOrdering([], packageInfos, [[]]);
  });

  it('sorts packages without dependencies', async () => {
    const packageInfos: PackageInfos = makePackageInfos({ foo: {}, bar: {} });

    await validateOrdering(['foo', 'bar'], packageInfos, [
      ['foo', 'bar'],
      ['bar', 'foo'],
    ]);
  });

  it('sorts packages with dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: {
        dependencies: { foo3: '1.0.0', bar2: '1.0.0' },
      },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo2: {},
    });

    await validateOrdering(['foo', 'foo2', 'foo3'], packageInfos, [['foo2', 'foo3', 'foo']]);
  });

  it.each(['dependencies', 'peerDependencies', 'optionalDependencies'] as const)(
    'considers %s for ordering',
    async dependencyType => {
      const packageInfos = makePackageInfos({
        foo: { [dependencyType]: { foo3: '1.0.0' } },
        foo2: {},
        foo3: { dependencies: { foo2: '1.0.0' } },
      });

      await validateOrdering(['foo', 'foo2', 'foo3'], packageInfos, [['foo2', 'foo3', 'foo']]);
    }
  );

  it('ignores devDependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { devDependencies: { foo3: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });
    // foo3 would be before foo if considering devDependencies
    await validateOrdering(['foo', 'foo2', 'foo3'], packageInfos, [['foo', 'foo2', 'foo3']]);
  });

  it('ignores external dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { external: '1.0.0' } },
      bar: {},
    });
    await validateOrdering(['foo', 'bar'], packageInfos, [['foo', 'bar']]);
  });

  it('sorts packages with different kinds of dependencies', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0' }, peerDependencies: { foo4: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: {},
    });

    await validateOrdering(['foo', 'foo2', 'foo3', 'foo4'], packageInfos, [
      ['foo2', 'foo3', 'foo4', 'foo'],
      ['foo2', 'foo4', 'foo3', 'foo'],
    ]);
  });

  it('ignores packages if not included', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: {},
      foo3: { dependencies: { foo2: '1.0.0' } },
    });

    await validateOrdering(['foo', 'foo3'], packageInfos, [['foo3', 'foo']]);
  });

  it('ignores packages if not included (harder scenario)', async () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { foo3: '1.0.0', bar: '1.0.0' } },
      foo2: { dependencies: { foo4: '1.0.0' } },
      foo3: { dependencies: { foo2: '1.0.0' } },
      foo4: {},
      bar: { dependencies: { foo: '1.0.0' } },
    });

    await validateOrdering(['foo', 'foo3'], packageInfos, [['foo3', 'foo']]);
  });

  it('throws on circular dependencies inside affected packages', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    expect(() => getPackageGraph(['foo', 'bar'], packageInfos)).toThrow(
      'Could not find a node in the graph with no dependencies'
    );
  });

  it('throws on circular dependencies', () => {
    const packageInfos = makePackageInfos({
      foo: { dependencies: { bar: '1.0.0', bar2: '1.0.0' } },
      bar: { dependencies: { foo: '1.0.0' } },
    });

    expect(() => getPackageGraph(['foo', 'bar'], packageInfos)).toThrow(
      'Could not find a node in the graph with no dependencies'
    );
  });

  it(`doesn't throw if graph contains circular dependencies outside affected packages`, async () => {
    const packageInfos = makePackageInfos({
      foo: {},
      bar: {},
      bar2: { dependencies: { bar3: '1.0.0' } },
      bar3: { dependencies: { bar2: '1.0.0', bar: '1.0.0' } },
    });

    const packageGraph = getPackageGraph(['foo', 'bar'], packageInfos);
    await getPackageGraphOrder(packageGraph);
  });

  it('throws if package info is missing', () => {
    expect(() => getPackageGraph(['foo', 'bar'], {})).toThrow(`Package info is missing for foo.`);
  });
});
